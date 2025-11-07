const request = require('supertest');
const { spawn } = require('child_process');
const path = require('path');
const { expect } = require('chai');
const app = require('../../../src/app');
const db = require('../../../src/models/db');
const { v4: uuidv4 } = require('uuid');

// Modo estrito (default) valida comportamento desejado e falha enquanto o bug existir.
// Modo permissivo (BUGS_LOOSE=1) considera que os testes devem falhar e inverte a asserção.
function tf(title, fn) {
  if (process.env.BUGS_LOOSE) {
    it(title, async function () {
      try {
        await fn.call(this);
        throw new Error('Teste passou, mas esperávamos falha (BUGS_LOOSE=1)');
      } catch (err) {
        // esperado: alguma asserção deve falhar
        expect(err).to.be.instanceOf(Error);
      }
    });
  } else {
    it(title, fn);
  }
}

describe('Bugs conhecidos - cenários', function () {
  this.timeout(20000);
  beforeEach(() => db.reset());

  describe('BUG-001 - Porta em uso (EADDRINUSE) ao iniciar', () => {
    tf('comportamento esperado: segundo processo deve lidar graciosamente com porta ocupada (sem EADDRINUSE)', async function () {
      this.timeout(15000);
      const indexJs = path.resolve(__dirname, '../../../../src/index.js');
      const testPort = String(41000 + Math.floor(Math.random() * 1000));

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
            started = true; clearTimeout(to); resolve();
          }
        });
        p1.on('exit', (code) => { clearTimeout(to); reject(new Error('p1 encerrou prematuramente ' + code)); });
      });
      expect(started).to.equal(true);

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

      p1.kill();

      expect(exitCode).to.equal(0);
      expect(stderr).to.not.match(/EADDRINUSE|already in use/i);
    });
  });

  describe('BUG-002 - Senhas armazenadas em texto', () => {
    tf('deveria armazenar senha com hash (não em texto puro)', async () => {
      const email = `bug2-${Date.now()}@ex.com`;
      const payload = { nome: 'Bug2', email, senha: 'minhasenha', papel: 'cliente' };
      const res = await request(app).post('/auth/cadastrar').send(payload);
      expect(res.status).to.equal(201);

      const stored = db.usuarios.find(u => u.email === email);
      expect(stored).to.exist;
      expect(stored.senha).to.not.equal('minhasenha');
      expect(/^\$2[aby]?\$/.test(stored.senha)).to.equal(true);
    });
  });

  describe('BUG-003 - Condição de corrida ao criar compromissos (double-booking)', () => {
    tf('comportamento esperado: garantir atomicidade (uma 201 e a outra 409 com mensagem adequada)', async () => {
      const cabe = { nome: 'CAB3', email: `cab3-${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
      await request(app).post('/auth/cadastrar').send(cabe);
      const loginC = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
      const tokenC = loginC.body.token;
      const dataHora = '2030-01-01T10:00:00Z';
      const reg = await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${tokenC}`).send({ dataHora });
      expect(reg.status).to.equal(201);

      const cli = { nome: 'Cli3', email: `cli3-${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
      await request(app).post('/auth/cadastrar').send(cli);
      const loginCli = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
      const tokenCli = loginCli.body.token;
      const servicoId = db.servicos[0].id;
      const cabeleireiroId = db.usuarios.find(u => u.papel === 'cabeleireiro' && u.email === cabe.email).id;

      const [r1, r2] = await Promise.all([
        request(app).post('/compromissos').set('Authorization', `Bearer ${tokenCli}`).send({ cabeleireiroId, servicoId, dataHora }),
        request(app).post('/compromissos').set('Authorization', `Bearer ${tokenCli}`).send({ cabeleireiroId, servicoId, dataHora })
      ]);
      const statuses = [r1.status, r2.status];
      expect(statuses.filter(s => s === 201).length).to.equal(1);
      expect(statuses.filter(s => s === 409).length).to.equal(1);
      const failed = r1.status !== 201 ? r1 : r2;
      expect(failed.body).to.have.property('erro');
      expect(String(failed.body.erro).toLowerCase()).to.match(/hor[aá]rio.*indispon[ií]vel/);
      const count = db.compromissos.filter(c => c.cabeleireiroId === cabeleireiroId && c.dataHora === dataHora).length;
      expect(count).to.equal(1);
    });
  });

  describe('BUG-004 - Validação fraca de data/hora (timezone/offset)', () => {
    tf('deveria aceitar horários equivalentes com offsets diferentes (normalizar para UTC)', async () => {
      const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
      const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha123' });
      const token = login.body.token;
      const utc = '2025-11-01T10:00:00Z';
      await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${token}`).send({ dataHora: utc });

      const cli = { nome: 'Cli4', email: `cli4-${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
      await request(app).post('/auth/cadastrar').send(cli);
      const loginCli = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
      const tokenCli = loginCli.body.token;

      const offset = '2025-11-01T07:00:00-03:00';
      const servicoId = db.servicos[0].id;
      const cabeleireiroId = cabe.id;
      const res = await request(app)
        .post('/compromissos')
        .set('Authorization', `Bearer ${tokenCli}`)
        .send({ cabeleireiroId, servicoId, dataHora: offset });
      expect(res.status).to.equal(201);
    });
  });

  describe('BUG-005 - Falta validar que cabeleireiroId refere-se a um cabeleireiro', () => {
    tf('deveria rejeitar agendamento usando id de CLIENTE como cabeleireiroId', async () => {
      const fakeCab = { nome: 'ClienteX', email: `clientex-${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
      await request(app).post('/auth/cadastrar').send(fakeCab);
      const fakeCabUser = db.usuarios.find(u => u.email === fakeCab.email);

      const dataHora = '2031-05-10T10:00:00Z';
      db.horariosDisponiveis.push({ id: uuidv4(), cabeleireiroId: fakeCabUser.id, dataHora });

      const cli = { nome: 'Agendador', email: `ag-${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
      await request(app).post('/auth/cadastrar').send(cli);
      const loginCli = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
      const tokenCli = loginCli.body.token;
      const servicoId = db.servicos[0].id;

      const res = await request(app)
        .post('/compromissos')
        .set('Authorization', `Bearer ${tokenCli}`)
        .send({ cabeleireiroId: fakeCabUser.id, servicoId, dataHora });
      expect([400, 403, 404]).to.include(res.status);
    });
  });

  describe('BUG-006 - Deletar serviço não limpa compromissos associados', () => {
    tf('deveria impedir remoção de serviço com compromissos (retornar 409/400)', async () => {
      const cabe = { nome: 'Cab6', email: `cab6-${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
      await request(app).post('/auth/cadastrar').send(cabe);
      const loginC = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
      const tokenC = loginC.body.token;
      const serv = await request(app)
        .post('/servicos')
        .set('Authorization', `Bearer ${tokenC}`)
        .send({ nome: 'Srv6', duracao: 30, preco: 50, categoria: 'x' });
      expect(serv.status).to.equal(201);

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

      const del = await request(app).delete(`/servicos/${serv.body.id}`).set('Authorization', `Bearer ${tokenC}`);
      expect([400, 409]).to.include(del.status);
    });
  });

  describe('BUG-007 - atualizar serviço não normaliza tipos (preço)', () => {
    tf('deveria normalizar preco para number ao atualizar', async () => {
      const cabe = { nome: 'Cab7', email: `cab7-${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
      await request(app).post('/auth/cadastrar').send(cabe);
      const loginC = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
      const tokenC = loginC.body.token;
      const serv = await request(app)
        .post('/servicos')
        .set('Authorization', `Bearer ${tokenC}`)
        .send({ nome: 'Srv7', duracao: 20, preco: 30, categoria: 'cat' });

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
      const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
      const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha123' });
      const token = login.body.token;
      const res = await request(app)
        .post('/cabeleireiros/horarios')
        .set('Authorization', `Bearer ${token}`)
        .send({ dataHora: 'nao-e-uma-data' });
      expect(res.status).to.equal(400);
    });

    tf('deveria rejeitar preco não numérico ao criar serviço (400)', async () => {
      const cabe = { nome: 'Cab8', email: `cab8-${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
      await request(app).post('/auth/cadastrar').send(cabe);
      const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
      const token = login.body.token;

      const res = await request(app)
        .post('/servicos')
        .set('Authorization', `Bearer ${token}`)
        .send({ nome: 'Srv8', duracao: 20, preco: 'abc', categoria: 'x' });
      expect(res.status).to.equal(400);
    });
  });
});
