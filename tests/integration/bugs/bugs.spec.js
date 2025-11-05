const request = require('supertest');
const { spawn } = require('child_process');
const path = require('path');
const app = require('../../../src/app');
const db = require('../../../src/models/db');
const { v4: uuidv4 } = require('uuid');

// Observação: estes testes automatizam CENÁRIOS de bugs listados no wiki/Historico-de-Bugs.md.
// Muitos deles validam o comportamento ATUAL (potencialmente incorreto) para documentar e reproduzir o problema.
// Quando o bug for corrigido, troque a expectativa e remova as observações correspondentes.

// Padrão: modo estrito (os testes validam comportamento desejado e falham enquanto o bug existir)
// Para rodar em modo permissivo (expected-fail), defina BUGS_LOOSE=1
// Ex.: BUGS_LOOSE=1 npm test -- tests/integration/bugs/bugs.spec.js
const tf = process.env.BUGS_LOOSE ? test.failing : test;

describe('Bugs conhecidos - cenários automatizados', () => {
  beforeEach(() => db.reset());

  describe('BUG-001 - Porta em uso (EADDRINUSE) ao iniciar', () => {
    tf('comportamento esperado: segundo processo deve lidar graciosamente com porta ocupada (sem EADDRINUSE)', async () => {
      jest.setTimeout(15000);
      const indexJs = path.resolve(__dirname, '../../../src/index.js');
      const testPort = String(41000 + Math.floor(Math.random() * 1000));

      // inicia primeiro processo
      const p1 = spawn(process.execPath, [indexJs], {
        env: { ...process.env, PORT: testPort },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let started = false;
      await new Promise((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('timeout aguardando p1 iniciar')), 6000);
        p1.stdout.on('data', (d) => {
          const s = d.toString();
          if (s.includes('Servidor rodando na porta')) {
            started = true;
            clearTimeout(to);
            resolve();
          }
        });
        p1.on('exit', (code) => {
          clearTimeout(to);
          reject(new Error('p1 encerrou prematuramente com código ' + code));
        });
      });
      expect(started).toBe(true);

      // tenta iniciar segundo processo na MESMA porta
      const p2 = spawn(process.execPath, [indexJs], {
        env: { ...process.env, PORT: testPort },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderr = '';
      let exitCode = null;
      await new Promise((resolve) => {
        const to = setTimeout(() => resolve(), 6000);
        p2.stderr.on('data', (d) => { stderr += d.toString(); });
        p2.on('exit', (code) => { exitCode = code; clearTimeout(to); resolve(); });
      });

      // encerra p1
      p1.kill();

      // comportamento esperado (ainda não implementado): sair graciosamente OU escolher outra porta
      // Critérios: exitCode 0 e sem mensagem EADDRINUSE no stderr
      expect(exitCode).toBe(0);
      expect(stderr).not.toMatch(/EADDRINUSE|already in use/i);
    });
  });

  describe('BUG-002 - Senhas armazenadas em texto', () => {
  tf('deveria armazenar senha com hash (não em texto puro)', async () => {
      const email = `bug2-${Date.now()}@ex.com`;
      const payload = { nome: 'Bug2', email, senha: 'minhasenha', papel: 'cliente' };
      const res = await request(app).post('/auth/cadastrar').send(payload);
      expect(res.status).toBe(201);

      const stored = db.usuarios.find(u => u.email === email);
      expect(stored).toBeDefined();
      // esperado após correção: senha não deve ser igual ao texto, e preferencialmente usar bcrypt ($2a|$2b|$2y$)
      expect(stored.senha).not.toBe('minhasenha');
      expect(/^\$2[aby]?\$/.test(stored.senha)).toBe(true);
    });
  });

  describe('BUG-003 - Condição de corrida ao criar compromissos (double-booking)', () => {
    tf('comportamento esperado: garantir atomicidade (uma 201 e a outra 409 com mensagem adequada)', async () => {
      // preparar cabeleireiro e horário
      const cabe = { nome: 'CAB3', email: `cab3-${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
      await request(app).post('/auth/cadastrar').send(cabe);
      const loginC = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
      const tokenC = loginC.body.token;
      const dataHora = '2030-01-01T10:00:00Z';
      const reg = await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${tokenC}`).send({ dataHora });
      expect(reg.status).toBe(201);

      // cliente e serviço
      const cli = { nome: 'Cli3', email: `cli3-${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
      await request(app).post('/auth/cadastrar').send(cli);
      const loginCli = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
      const tokenCli = loginCli.body.token;
      const servicoId = db.servicos[0].id;
      const cabeleireiroId = db.usuarios.find(u => u.papel === 'cabeleireiro' && u.email === cabe.email).id;

      // dispara duas requisições em paralelo
      const [r1, r2] = await Promise.all([
        request(app).post('/compromissos').set('Authorization', `Bearer ${tokenCli}`).send({ cabeleireiroId, servicoId, dataHora }),
        request(app).post('/compromissos').set('Authorization', `Bearer ${tokenCli}`).send({ cabeleireiroId, servicoId, dataHora })
      ]);

      const statuses = [r1.status, r2.status];
      // esperado: exatamente um sucesso 201 e um conflito 409
      expect(statuses.filter(s => s === 201).length).toBe(1);
      expect(statuses.filter(s => s === 409).length).toBe(1);
      // a resposta que falhou deve ter mensagem clara de indisponibilidade
      const failed = r1.status !== 201 ? r1 : r2;
      expect(failed.body).toHaveProperty('erro');
      expect(failed.body.erro).toMatch(/hor[aá]rio.*indispon[ií]vel/i);
      // e o banco deve ter apenas um compromisso para o slot
      const count = db.compromissos.filter(c => c.cabeleireiroId === cabeleireiroId && c.dataHora === dataHora).length;
      expect(count).toBe(1);
    });
  });

  describe('BUG-004 - Validação fraca de data/hora (timezone/offset)', () => {
  tf('deveria aceitar horários equivalentes com offsets diferentes (normalizar para UTC)', async () => {
      // preparar cabeleireiro e registrar horário UTC
      const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
      const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha123' });
      const token = login.body.token;
      const utc = '2025-11-01T10:00:00Z';
      await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${token}`).send({ dataHora: utc });

      // cliente tenta agendar usando offset -03:00 equivalente
      const cli = { nome: 'Cli4', email: `cli4-${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
      await request(app).post('/auth/cadastrar').send(cli);
      const loginCli = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
      const tokenCli = loginCli.body.token;

      const offset = '2025-11-01T07:00:00-03:00';
      const servicoId = db.servicos[0].id;
      const cabeleireiroId = cabe.id;
      const res = await request(app).post('/compromissos').set('Authorization', `Bearer ${tokenCli}`).send({ cabeleireiroId, servicoId, dataHora: offset });
      // esperado após correção: aceitar offset equivalente (201)
      expect(res.status).toBe(201);
    });
  });

  describe('BUG-005 - Falta validar que cabeleireiroId refere-se a um cabeleireiro', () => {
  tf('deveria rejeitar agendamento usando id de CLIENTE como cabeleireiroId', async () => {
      // cria cliente que será usado como "falso cabeleireiro"
      const fakeCab = { nome: 'ClienteX', email: `clientex-${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
      await request(app).post('/auth/cadastrar').send(fakeCab);
      const fakeCabUser = db.usuarios.find(u => u.email === fakeCab.email);

      // injeta horário disponível manualmente apontando para o cliente
      const dataHora = '2031-05-10T10:00:00Z';
      db.horariosDisponiveis.push({ id: uuidv4(), cabeleireiroId: fakeCabUser.id, dataHora });

      // cria cliente real que fará o agendamento
      const cli = { nome: 'Agendador', email: `ag-${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
      await request(app).post('/auth/cadastrar').send(cli);
      const loginCli = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
      const tokenCli = loginCli.body.token;
      const servicoId = db.servicos[0].id;

      const res = await request(app).post('/compromissos').set('Authorization', `Bearer ${tokenCli}`).send({ cabeleireiroId: fakeCabUser.id, servicoId, dataHora });
      // esperado após correção: rejeitar (400/403/404)
      expect([400, 403, 404]).toContain(res.status);
    });
  });

  describe('BUG-006 - Deletar serviço não limpa compromissos associados', () => {
  tf('deveria impedir remoção de serviço com compromissos (retornar 409/400)', async () => {
      // cabeleireiro cria serviço
      const cabe = { nome: 'Cab6', email: `cab6-${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
      await request(app).post('/auth/cadastrar').send(cabe);
      const loginC = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
      const tokenC = loginC.body.token;
      const serv = await request(app).post('/servicos').set('Authorization', `Bearer ${tokenC}`).send({ nome: 'Srv6', duracao: 30, preco: 50, categoria: 'x' });
      expect(serv.status).toBe(201);

      // registra horário
      const dataHora = '2032-02-02T12:00:00Z';
      await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${tokenC}`).send({ dataHora });

      // cliente agenda
      const cli = { nome: 'Cli6', email: `cli6-${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
      await request(app).post('/auth/cadastrar').send(cli);
      const loginCli = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
      const tokenCli = loginCli.body.token;
      const cabeUser = db.usuarios.find(u => u.email === cabe.email);
      const ag = await request(app).post('/compromissos').set('Authorization', `Bearer ${tokenCli}`).send({ cabeleireiroId: cabeUser.id, servicoId: serv.body.id, dataHora });
      expect(ag.status).toBe(201);

      // remove serviço
      const del = await request(app).delete(`/servicos/${serv.body.id}`).set('Authorization', `Bearer ${tokenC}`);
      // esperado após correção: impedir remoção se houver vínculos (409/400)
      expect([400, 409]).toContain(del.status);
    });
  });

  describe('BUG-007 - atualizar serviço não normaliza tipos (preço)', () => {
  tf('deveria normalizar preco para number ao atualizar', async () => {
      // cabeleireiro cria serviço
      const cabe = { nome: 'Cab7', email: `cab7-${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
      await request(app).post('/auth/cadastrar').send(cabe);
      const loginC = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
      const tokenC = loginC.body.token;
      const serv = await request(app).post('/servicos').set('Authorization', `Bearer ${tokenC}`).send({ nome: 'Srv7', duracao: 20, preco: 30, categoria: 'cat' });

      const up = await request(app).put(`/servicos/${serv.body.id}`).set('Authorization', `Bearer ${tokenC}`).send({ preco: '120' });
      expect(up.status).toBe(200);
      // esperado após correção: preco deverá ser number (120)
      expect(typeof up.body.preco).toBe('number');
      expect(up.body.preco).toBe(120);
    });
  });

  describe('BUG-008 - falta de validação/sanitização de entrada', () => {
  tf('deveria rejeitar dataHora inválido ao registrar horário (400)', async () => {
      const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
      const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha123' });
      const token = login.body.token;
      const res = await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${token}`).send({ dataHora: 'nao-e-uma-data' });
      expect(res.status).toBe(400);
    });

  tf('deveria rejeitar preco não numérico ao criar serviço (400)', async () => {
      const cabe = { nome: 'Cab8', email: `cab8-${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
      await request(app).post('/auth/cadastrar').send(cabe);
      const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
      const token = login.body.token;

      const res = await request(app).post('/servicos').set('Authorization', `Bearer ${token}`).send({ nome: 'Srv8', duracao: 20, preco: 'abc', categoria: 'x' });
      expect(res.status).toBe(400);
    });
  });
});
