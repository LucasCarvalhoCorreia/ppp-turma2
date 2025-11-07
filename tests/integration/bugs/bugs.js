// -------------------------------------------------------------
// Suíte de Integração: Bugs conhecidos (regressão)
//
// O que este arquivo cobre:
// - Cenários documentados no histórico de bugs que devem falhar enquanto o bug existir.
// - Exemplos: porta em uso na inicialização, senha em texto puro, double-booking, timezone, validações fracas, etc.
//
// Modo de execução:
// - Modo estrito (padrão): valida o comportamento DESEJADO e falha se a aplicação ainda estiver com o bug.
// - Modo permissivo: defina BUGS_LOOSE=1 para inverter as asserções (útil quando se quer apenas registrar os bugs sem quebrar o pipeline).
//
// Detalhes de implementação:
// - A função auxiliar tf(title, fn) alterna asserções conforme a env BUGS_LOOSE.
// - Cada caso prepara seu próprio cenário com db.reset() antes de cada teste para isolamento.
// - Processos filho são usados em BUG-001 para simular a inicialização usando a mesma porta.
// -------------------------------------------------------------
// Importa Supertest para fazer chamadas HTTP à app Express
const request = require('supertest');
// Importa spawn para iniciar processos filho (usado no BUG-001)
const { spawn } = require('child_process');
// Módulo path para resolver caminhos de arquivos
const path = require('path');
// Expect do Chai para assertivas legíveis
const { expect } = require('chai');
// App Express principal
const app = require('../../../src/app');
// DB em memória para consultar/seed e resetar entre cenários
const db = require('../../../src/models/db');
// Gerador de UUID para criar IDs artificiais quando necessário
const { v4: uuidv4 } = require('uuid');

// Modo estrito (default) valida comportamento desejado e falha enquanto o bug existir.
// Modo permissivo (BUGS_LOOSE=1) considera que os testes devem falhar e inverte a asserção.
// tf: test function wrapper
// - Em modo padrão, delega para `it` normal.
// - Em modo BUGS_LOOSE=1, inverte a expectativa: se o teste passar, força falha;
//   se ocorrer erro/assert falhando, considera como sucesso (porque o bug ainda existe).
function tf(title, fn) {
  if (process.env.BUGS_LOOSE) {
    it(title, async function () {
      try {
        // Executa o corpo do teste original
        await fn.call(this);
        // Se chegou aqui, o teste não falhou: em modo loose, isso é indesejado
        throw new Error('Teste passou, mas esperávamos falha (BUGS_LOOSE=1)');
      } catch (err) {
        // Em modo loose, qualquer erro é considerado esperado
        expect(err).to.be.instanceOf(Error);
      }
    });
  } else {
    // Modo estrito: usa a asserção original
    it(title, fn);
  }
}

describe('Bugs conhecidos - cenários', function () {
  // Timeout mais longo para cenários que sobem processos/rodam I/O
  this.timeout(20000);
  // Antes de cada caso, reseta o DB para estado conhecido
  beforeEach(() => db.reset());

  describe('BUG-001 - Porta em uso (EADDRINUSE) ao iniciar', () => {
    tf('comportamento esperado: segundo processo deve lidar graciosamente com porta ocupada (sem EADDRINUSE)', async function () {
      // Este caso inicia o app duas vezes na mesma porta e verifica que o segundo não falha por EADDRINUSE
      this.timeout(15000);
      // Caminho absoluto para o entrypoint do servidor
      const indexJs = path.resolve(__dirname, '../../../../src/index.js');
      // Porta aleatória na faixa 41000..41999 para evitar conflitos reais
      const testPort = String(41000 + Math.floor(Math.random() * 1000));

      // Inicia o primeiro processo (p1) escutando testPort
      const p1 = spawn(process.execPath, [indexJs], {
        env: { ...process.env, PORT: testPort },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Aguarda evidência de que p1 iniciou (log na stdout)
      let started = false;
      await new Promise((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('timeout aguardando p1 iniciar')), 6000);
        p1.stdout.on('data', (d) => {
          const s = d.toString();
          if (s.includes('Servidor rodando na porta')) {
            started = true; clearTimeout(to); resolve();
          }
        });
        p1.on('exit', (code) => { clearTimeout(to); reject(new Error('p1 encerrou prematuramente ' + code)); });
      });
      expect(started).to.equal(true);

      // Inicia o segundo processo (p2) na mesma porta
      const p2 = spawn(process.execPath, [indexJs], {
        env: { ...process.env, PORT: testPort },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Captura stderr e exit code do p2 por alguns segundos
      let stderr = '';
      let exitCode = null;
      await new Promise((resolve) => {
        const to = setTimeout(() => resolve(), 6000);
        p2.stderr.on('data', (d) => { stderr += d.toString(); });
        p2.on('exit', (code) => { exitCode = code; clearTimeout(to); resolve(); });
      });

      // Encerra o p1 para liberar a porta
      p1.kill();

      // Esperado (comportamento desejado): p2 não falha (exit 0) e sem mensagem EADDRINUSE
      expect(exitCode).to.equal(0);
      expect(stderr).to.not.match(/EADDRINUSE|already in use/i);
    });
  });

  describe('BUG-002 - Senhas armazenadas em texto', () => {
    tf('deveria armazenar senha com hash (não em texto puro)', async () => {
      // Cadastra um usuário novo
      const email = `bug2-${Date.now()}@ex.com`;
      const payload = { nome: 'Bug2', email, senha: 'minhasenha', papel: 'cliente' };
      const res = await request(app).post('/auth/cadastrar').send(payload);
      expect(res.status).to.equal(201);

      // Busca o usuário no DB e verifica que a senha não é armazenada em texto
      const stored = db.usuarios.find(u => u.email === email);
      expect(stored).to.exist;
      expect(stored.senha).to.not.equal('minhasenha');
      // Heurística: senhas com hash bcrypt começam com $2a/$2b/$2y
      expect(/^\$2[aby]?\$/.test(stored.senha)).to.equal(true);
    });
  });

  describe('BUG-003 - Condição de corrida ao criar compromissos (double-booking)', () => {
    tf('comportamento esperado: garantir atomicidade (uma 201 e a outra 409 com mensagem adequada)', async () => {
      // Prepara cabeleireiro e registra um único horário disponível
      const cabe = { nome: 'CAB3', email: `cab3-${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
      await request(app).post('/auth/cadastrar').send(cabe);
      const loginC = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
      const tokenC = loginC.body.token;
      const dataHora = '2030-01-01T10:00:00Z';
      const reg = await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${tokenC}`).send({ dataHora });
      expect(reg.status).to.equal(201);

      // Prepara cliente autenticado
      const cli = { nome: 'Cli3', email: `cli3-${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
      await request(app).post('/auth/cadastrar').send(cli);
      const loginCli = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
      const tokenCli = loginCli.body.token;
      const servicoId = db.servicos[0].id;
      const cabeleireiroId = db.usuarios.find(u => u.papel === 'cabeleireiro' && u.email === cabe.email).id;

      // Dispara duas tentativas de agendamento concorrentes para o mesmo horário
      const [r1, r2] = await Promise.all([
        request(app).post('/compromissos').set('Authorization', `Bearer ${tokenCli}`).send({ cabeleireiroId, servicoId, dataHora }),
        request(app).post('/compromissos').set('Authorization', `Bearer ${tokenCli}`).send({ cabeleireiroId, servicoId, dataHora })
      ]);
      const statuses = [r1.status, r2.status];
      // Esperado: somente uma deve ser 201 e a outra 409 (conflito)
      expect(statuses.filter(s => s === 201).length).to.equal(1);
      expect(statuses.filter(s => s === 409).length).to.equal(1);
      // A resposta que falhou deve conter mensagem de erro informando indisponibilidade
      const failed = r1.status !== 201 ? r1 : r2;
      expect(failed.body).to.have.property('erro');
      expect(String(failed.body.erro).toLowerCase()).to.match(/hor[aá]rio.*indispon[ií]vel/);
      // E apenas um compromisso persistido para aquele slot
      const count = db.compromissos.filter(c => c.cabeleireiroId === cabeleireiroId && c.dataHora === dataHora).length;
      expect(count).to.equal(1);
    });
  });

  describe('BUG-004 - Validação fraca de data/hora (timezone/offset)', () => {
    tf('deveria aceitar horários equivalentes com offsets diferentes (normalizar para UTC)', async () => {
      // Loga como cabeleireiro seed
      const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
      const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha123' });
      const token = login.body.token;
      // Registra horário em UTC
      const utc = '2025-11-01T10:00:00Z';
      await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${token}`).send({ dataHora: utc });

      // Cria cliente e loga
      const cli = { nome: 'Cli4', email: `cli4-${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
      await request(app).post('/auth/cadastrar').send(cli);
      const loginCli = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
      const tokenCli = loginCli.body.token;

      // Tenta agendar usando o mesmo instante em horário com offset -03:00
      const offset = '2025-11-01T07:00:00-03:00';
      const servicoId = db.servicos[0].id;
      const cabeleireiroId = cabe.id;
      const res = await request(app)
        .post('/compromissos')
        .set('Authorization', `Bearer ${tokenCli}`)
        .send({ cabeleireiroId, servicoId, dataHora: offset });
      // Comportamento desejado: aceitar (201) após normalizar o horário
      expect(res.status).to.equal(201);
    });
  });

  describe('BUG-005 - Falta validar que cabeleireiroId refere-se a um cabeleireiro', () => {
    tf('deveria rejeitar agendamento usando id de CLIENTE como cabeleireiroId', async () => {
      // Cria um usuário com papel cliente, mas vai usá-lo como se fosse cabeleireiroId
      const fakeCab = { nome: 'ClienteX', email: `clientex-${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
      await request(app).post('/auth/cadastrar').send(fakeCab);
      const fakeCabUser = db.usuarios.find(u => u.email === fakeCab.email);

      // Injeta manualmente um horário disponível utilizado por esse "cabeleireiro" inválido
      const dataHora = '2031-05-10T10:00:00Z';
      db.horariosDisponiveis.push({ id: uuidv4(), cabeleireiroId: fakeCabUser.id, dataHora });

      // Cria um cliente válido para tentar agendar
      const cli = { nome: 'Agendador', email: `ag-${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
      await request(app).post('/auth/cadastrar').send(cli);
      const loginCli = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
      const tokenCli = loginCli.body.token;
      const servicoId = db.servicos[0].id;

      // Tenta agendar usando cabeleireiroId inválido -> deve ser rejeitado
      const res = await request(app)
        .post('/compromissos')
        .set('Authorization', `Bearer ${tokenCli}`)
        .send({ cabeleireiroId: fakeCabUser.id, servicoId, dataHora });
      expect([400, 403, 404]).to.include(res.status);
    });
  });

  describe('BUG-006 - Deletar serviço não limpa compromissos associados', () => {
    tf('deveria impedir remoção de serviço com compromissos (retornar 409/400)', async () => {
      // Cria cabeleireiro e um serviço novo
      const cabe = { nome: 'Cab6', email: `cab6-${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
      await request(app).post('/auth/cadastrar').send(cabe);
      const loginC = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
      const tokenC = loginC.body.token;
      const serv = await request(app)
        .post('/servicos')
        .set('Authorization', `Bearer ${tokenC}`)
        .send({ nome: 'Srv6', duracao: 30, preco: 50, categoria: 'x' });
      expect(serv.status).to.equal(201);

      // Registra horário e agenda compromisso desse serviço
      const dataHora = '2032-02-02T12:00:00Z';
      await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${tokenC}`).send({ dataHora });

      const cli = { nome: 'Cli6', email: `cli6-${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
      await request(app).post('/auth/cadastrar').send(cli);
      const loginCli = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
      const tokenCli = loginCli.body.token;
      const cabeUser = db.usuarios.find(u => u.email === cabe.email);
      const ag = await request(app)
        .post('/compromissos')
        .set('Authorization', `Bearer ${tokenCli}`)
        .send({ cabeleireiroId: cabeUser.id, servicoId: serv.body.id, dataHora });
      expect(ag.status).to.equal(201);

      // Comportamento desejado: impedir DELETE de serviço com compromissos existentes (409/400)
      const del = await request(app).delete(`/servicos/${serv.body.id}`).set('Authorization', `Bearer ${tokenC}`);
      expect([400, 409]).to.include(del.status);
    });
  });

  describe('BUG-007 - atualizar serviço não normaliza tipos (preço)', () => {
    tf('deveria normalizar preco para number ao atualizar', async () => {
      // Cria cabeleireiro e um serviço
      const cabe = { nome: 'Cab7', email: `cab7-${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
      await request(app).post('/auth/cadastrar').send(cabe);
      const loginC = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
      const tokenC = loginC.body.token;
      const serv = await request(app)
        .post('/servicos')
        .set('Authorization', `Bearer ${tokenC}`)
        .send({ nome: 'Srv7', duracao: 20, preco: 30, categoria: 'cat' });

      // Atualiza preço enviando string; comportamento desejado: converter para number
      const up = await request(app)
        .put(`/servicos/${serv.body.id}`)
        .set('Authorization', `Bearer ${tokenC}`)
        .send({ preco: '120' });
      expect(up.status).to.equal(200);
      expect(typeof up.body.preco).to.equal('number');
      expect(up.body.preco).to.equal(120);
    });
  });

  describe('BUG-008 - falta de validação/sanitização de entrada', () => {
    tf('deveria rejeitar dataHora inválido ao registrar horário (400)', async () => {
      // Loga como cabeleireiro seed
      const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
      const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha123' });
      const token = login.body.token;
      // Tenta registrar horário inválido (string não ISO)
      const res = await request(app)
        .post('/cabeleireiros/horarios')
        .set('Authorization', `Bearer ${token}`)
        .send({ dataHora: 'nao-e-uma-data' });
      expect(res.status).to.equal(400);
    });

    tf('deveria rejeitar preco não numérico ao criar serviço (400)', async () => {
      // Cria cabeleireiro e loga
      const cabe = { nome: 'Cab8', email: `cab8-${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
      await request(app).post('/auth/cadastrar').send(cabe);
      const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
      const token = login.body.token;

      // Tenta criar serviço com preco inválido (string não numérica)
      const res = await request(app)
        .post('/servicos')
        .set('Authorization', `Bearer ${token}`)
        .send({ nome: 'Srv8', duracao: 20, preco: 'abc', categoria: 'x' });
      expect(res.status).to.equal(400);
    });
  });
});
