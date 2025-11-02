const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/models/db');
const { v4: uuidv4 } = require('uuid');

describe('Compromissos integration', () => {
  beforeEach(() => db.reset());

  describe('Caminho feliz', () => {
    test('CT-Comp-01 - fluxo: cabeleireiro registra horário; cliente agenda; cliente vê compromisso', async () => {
      // criar cabeleireiro e logar
      const cabe = { nome: 'Cabele', email: `cab${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
      await request(app).post('/auth/cadastrar').send(cabe);
      const loginC = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
      const tokenC = loginC.body.token;

      // registrar horário
      const dataHora = '2025-11-01T10:00:00Z';
      const reg = await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${tokenC}`).send({ dataHora });
      expect(reg.status).toBe(201);

      // criar cliente e logar
      const cli = { nome: 'Cliente', email: `cli${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
      await request(app).post('/auth/cadastrar').send(cli);
      const loginCli = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
      const tokenCli = loginCli.body.token;

      // usar servico já existente (seed)
      const servicoId = db.servicos[0].id;
      const cabeleireiroId = db.usuarios.find(u => u.papel === 'cabeleireiro' && u.email === cabe.email).id;

      // cliente agenda
      const ag = await request(app).post('/compromissos').set('Authorization', `Bearer ${tokenCli}`).send({ cabeleireiroId, servicoId, dataHora });
      expect(ag.status).toBe(201);

      // cliente lista compromissos
      const lista = await request(app).get('/compromissos').set('Authorization', `Bearer ${tokenCli}`);
      expect(lista.status).toBe(200);
      expect(Array.isArray(lista.body)).toBe(true);
      expect(lista.body.find(c => c.id === ag.body.id)).toBeDefined();
    });

    test('CT-Comp-06 - listar compromissos por usuário (cliente e cabeleireiro)', async () => {
      // preparar cabeleireiro
      const cabe = { nome: 'CComp', email: `ccomp${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
      await request(app).post('/auth/cadastrar').send(cabe);
      const loginC = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
      const tokenC = loginC.body.token;

      // registrar horario
      const dataHora = '2025-11-05T11:00:00Z';
      const reg = await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${tokenC}`).send({ dataHora });
      expect(reg.status).toBe(201);

      // criar cliente e logar
      const cli = { nome: 'ClienteX', email: `clix2${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
      await request(app).post('/auth/cadastrar').send(cli);
      const loginCli = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
      const tokenCli = loginCli.body.token;

      const servicoId = db.servicos[0].id;
      const cabeleireiroId = db.usuarios.find(u => u.papel === 'cabeleireiro' && u.email === cabe.email).id;

      // cliente agenda
      const ag = await request(app).post('/compromissos').set('Authorization', `Bearer ${tokenCli}`).send({ cabeleireiroId, servicoId, dataHora });
      expect(ag.status).toBe(201);

      // cliente lista
      const listCli = await request(app).get('/compromissos').set('Authorization', `Bearer ${tokenCli}`);
      expect(listCli.status).toBe(200);
      expect(listCli.body.some(c => c.id === ag.body.id)).toBe(true);

      // cabeleireiro lista
      const listCab = await request(app).get('/compromissos').set('Authorization', `Bearer ${tokenC}`);
      expect(listCab.status).toBe(200);
      expect(listCab.body.some(c => c.id === ag.body.id)).toBe(true);
    });
  });

  describe('Caminho infeliz', () => {
    test('CT-Comp-02 - agendar sem token retorna 401', async () => {
      const res = await request(app).post('/compromissos').send({ cabeleireiroId: 'x', servicoId: 'y', dataHora: '2025-11-01T10:00:00Z' });
      expect(res.status).toBe(401);
    });

    test('CT-Comp-03 - agendar horário indisponível retorna 400 (caso isolado)', async () => {
      // criar cliente e logar
      const cli = { nome: 'CliZ', email: `cliz${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
      await request(app).post('/auth/cadastrar').send(cli);
      const login = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
      const token = login.body.token;

      const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
      const servicoId = db.servicos[0].id;
      const dataHora = '2040-01-01T00:00:00Z'; // data não registrada

      const res = await request(app).post('/compromissos').set('Authorization', `Bearer ${token}`).send({ cabeleireiroId: cabe.id, servicoId, dataHora });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('erro');
    });

    test('CT-Comp-04 - agendar com servico inválido retorna 400', async () => {
      // criar cliente e logar
      const cli = { nome: 'Cli', email: `cli${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
      await request(app).post('/auth/cadastrar').send(cli);
      const login = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
      const token = login.body.token;

      // cabeleireiro e horario
      const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
      const dataHora = '2025-11-01T12:00:00Z';
      db.horariosDisponiveis.push({ id: uuidv4(), cabeleireiroId: cabe.id, dataHora });

      const res = await request(app).post('/compromissos').set('Authorization', `Bearer ${token}`).send({ cabeleireiroId: cabe.id, servicoId: 'invalido', dataHora });
      expect(res.status).toBe(400);
    });

    test('CT-Comp-05 - agendar mesmo horário duas vezes (segundo falha)', async () => {
      // criar cliente e logar
      const cli1 = { nome: 'C1', email: `c1${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
      const cli2 = { nome: 'C2', email: `c2${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
      await request(app).post('/auth/cadastrar').send(cli1);
      await request(app).post('/auth/cadastrar').send(cli2);
      const l1 = await request(app).post('/auth/login').send({ email: cli1.email, senha: 'senha' });
      const l2 = await request(app).post('/auth/login').send({ email: cli2.email, senha: 'senha' });
      const t1 = l1.body.token;
      const t2 = l2.body.token;

      const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
      const servico = db.servicos[0];
      const dataHora = '2025-11-02T09:00:00Z';
      db.horariosDisponiveis.push({ id: uuidv4(), cabeleireiroId: cabe.id, dataHora });

      const r1 = await request(app).post('/compromissos').set('Authorization', `Bearer ${t1}`).send({ cabeleireiroId: cabe.id, servicoId: servico.id, dataHora });
      expect(r1.status).toBe(201);

      const r2 = await request(app).post('/compromissos').set('Authorization', `Bearer ${t2}`).send({ cabeleireiroId: cabe.id, servicoId: servico.id, dataHora });
      expect(r2.status).toBe(400);
    });
  });
});
