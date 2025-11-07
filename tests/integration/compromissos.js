const request = require('supertest');
const { expect } = require('chai');
const app = require('../../src/app');
const db = require('../../src/models/db');

describe('Compromissos', function () {
  this.timeout(20000);
  beforeEach(() => db.reset());

  it('CT-Comp-01 - fluxo: cabeleireiro registra horário; cliente agenda; cliente vê compromisso', async () => {
    // cria cabeleireiro e horário
    const cab = { nome: 'Cab', email: `cab_${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
    await request(app).post('/auth/cadastrar').send(cab);
    const cabLogin = await request(app).post('/auth/login').send({ email: cab.email, senha: 'senha' });
    const cabToken = cabLogin.body.token;

    const dataHora = new Date(Date.now() + 7200_000).toISOString();
    await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${cabToken}`).send({ dataHora });

    // cria cliente
    const cli = { nome: 'Cli', email: `cli_${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
    await request(app).post('/auth/cadastrar').send(cli);
    const cliLogin = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
    const cliToken = cliLogin.body.token;

    // garante um serviço
    let servId;
    const servList = await request(app).get('/servicos');
    if (Array.isArray(servList.body) && servList.body.length > 0) {
      servId = servList.body[0].id;
    } else {
      const sres = await request(app)
        .post('/servicos')
        .set('Authorization', `Bearer ${cabToken}`)
        .send({ nome: 'Corte', duracao: 30, preco: 50, categoria: 'cabelo' });
      servId = sres.body.id;
    }

    const create = await request(app)
      .post('/compromissos')
      .set('Authorization', `Bearer ${cliToken}`)
      .send({ cabeleireiroId: db.usuarios.find(u => u.email === cab.email).id, servicoId: servId, dataHora });

    expect(create.status).to.equal(201);

    const list = await request(app)
      .get('/compromissos')
      .set('Authorization', `Bearer ${cliToken}`);
    expect(list.status).to.equal(200);
    expect(list.body).to.be.an('array');
  });

  it('CT-Comp-02 - agendar sem token retorna 401', async () => {
    const res = await request(app).post('/compromissos').send({ cabeleireiroId: 'x', servicoId: 'y', dataHora: '2025-11-01T10:00:00Z' });
    expect(res.status).to.equal(401);
  });

  it('CT-Comp-03 - agendar horário indisponível retorna 400 (caso isolado)', async () => {
    const cli = { nome: 'CliZ', email: `cliz${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
    await request(app).post('/auth/cadastrar').send(cli);
    const login = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
    const token = login.body.token;

    const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
    const servicoId = db.servicos[0].id;
    const dataHora = '2040-01-01T00:00:00Z';

    const res = await request(app)
      .post('/compromissos')
      .set('Authorization', `Bearer ${token}`)
      .send({ cabeleireiroId: cabe.id, servicoId, dataHora });
    expect(res.status).to.equal(400);
    expect(res.body).to.have.property('erro');
  });

  it('CT-Comp-04 - agendar com servico inválido retorna 400', async () => {
    const cli = { nome: 'Cli', email: `cli${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
    await request(app).post('/auth/cadastrar').send(cli);
    const login = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
    const token = login.body.token;

    const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
    const dataHora = '2025-11-01T12:00:00Z';
    const { v4: uuidv4 } = require('uuid');
    db.horariosDisponiveis.push({ id: uuidv4(), cabeleireiroId: cabe.id, dataHora });

    const res = await request(app)
      .post('/compromissos')
      .set('Authorization', `Bearer ${token}`)
      .send({ cabeleireiroId: cabe.id, servicoId: 'invalido', dataHora });
    expect(res.status).to.equal(400);
  });

  it('CT-Comp-05 - agendar mesmo horário duas vezes (segundo falha)', async () => {
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
    const { v4: uuidv4 } = require('uuid');
    db.horariosDisponiveis.push({ id: uuidv4(), cabeleireiroId: cabe.id, dataHora });

    const r1 = await request(app)
      .post('/compromissos')
      .set('Authorization', `Bearer ${t1}`)
      .send({ cabeleireiroId: cabe.id, servicoId: servico.id, dataHora });
    expect(r1.status).to.equal(201);

    const r2 = await request(app)
      .post('/compromissos')
      .set('Authorization', `Bearer ${t2}`)
      .send({ cabeleireiroId: cabe.id, servicoId: servico.id, dataHora });
    expect(r2.status).to.equal(400);
  });
});
