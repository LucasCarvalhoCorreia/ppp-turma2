const request = require('supertest');
const { expect } = require('chai');
const app = require('../../src/app');
const db = require('../../src/models/db');
const { v4: uuidv4 } = require('uuid');

describe('Servicos', function () {
  this.timeout(15000);
  beforeEach(() => db.reset());

  it('CT-Serv-01 - GET /servicos retorna array e 200', async () => {
    const res = await request(app).get('/servicos');
    expect(res.status).to.equal(200);
    expect(res.body).to.be.an('array');
  });

  it('CT-Serv-02 - POST /servicos com token de cabeleireiro cria serviço', async () => {
    const cabe = { nome: 'Cabele', email: `cab_${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
    await request(app).post('/auth/cadastrar').send(cabe);
    const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
    const token = login.body.token;

    const res = await request(app)
      .post('/servicos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Escova', duracao: 30, preco: 60, categoria: 'cabelo' });

    expect(res.status).to.equal(201);
    expect(res.body).to.have.property('id');
  });

  it('CT-Serv-03 - POST /servicos sem token retorna 401', async () => {
    const res = await request(app).post('/servicos').send({ nome: 'X', duracao: 10, preco: 10, categoria: 'teste' });
    expect(res.status).to.equal(401);
  });
});

describe('Servicos - GET /servicos/{id}', function () {
  this.timeout(10000);
  beforeEach(() => db.reset());

  it('CT-Serv-07 - retorna 200 e o serviço quando id existe (happy path)', async () => {
    const existing = db.servicos[0];
    const res = await request(app).get(`/servicos/${existing.id}`);
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('id', existing.id);
    expect(res.body).to.have.property('nome', existing.nome);
    expect(res.body).to.have.property('duracao');
    expect(res.body).to.have.property('preco');
    expect(res.body).to.have.property('categoria');
  });

  it('CT-Serv-08 - retorna 404 quando id não existe', async () => {
    const fakeId = uuidv4();
    const res = await request(app).get(`/servicos/${fakeId}`);
    expect([404]).to.include(res.status);
    expect(res.body).to.have.property('erro');
    expect(String(res.body.erro).toLowerCase()).to.match(/servi[cç]o não encontrado|servico nao encontrado/);
  });

  it('CT-Serv-09 - id malformado retorna 404 (implementação atual)', async () => {
    const badId = 'abc123';
    const res = await request(app).get(`/servicos/${badId}`);
    expect([400, 404]).to.include(res.status);
    if (res.status === 404) {
      expect(res.body).to.have.property('erro');
    }
  });
});

describe('Servicos - PUT/DELETE /servicos/{id}', function () {
  this.timeout(15000);
  beforeEach(() => db.reset());

  it('CT-Serv-05 - cabeleireiro consegue atualizar serviço', async () => {
    const cabe = { nome: 'Cabele', email: `cab${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
    await request(app).post('/auth/cadastrar').send(cabe);
    const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
    const token = login.body.token;

    const res = await request(app).post('/servicos').set('Authorization', `Bearer ${token}`).send({ nome: 'Teste', duracao: 20, preco: 30, categoria: 'cabelo' });
    expect(res.status).to.equal(201);
    const id = res.body.id;

    const up = await request(app).put(`/servicos/${id}`).set('Authorization', `Bearer ${token}`).send({ preco: 40 });
    expect(up.status).to.equal(200);
    expect(up.body.preco).to.equal(40);
  });

  it('CT-Serv-06 - remover serviço (DELETE) retorna 204 e 404 subsequente', async () => {
    const cabe = { nome: 'Cabele2', email: `cab2${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
    await request(app).post('/auth/cadastrar').send(cabe);
    const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
    const token = login.body.token;

    const res = await request(app).post('/servicos').set('Authorization', `Bearer ${token}`).send({ nome: 'RemoverTeste', duracao: 20, preco: 30, categoria: 'cabelo' });
    expect(res.status).to.equal(201);
    const id = res.body.id;

    const del = await request(app).delete(`/servicos/${id}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).to.equal(204);

    const del2 = await request(app).delete(`/servicos/${id}`).set('Authorization', `Bearer ${token}`);
    expect(del2.status).to.equal(404);
  });

  it('CT-Serv-04 - cliente não pode criar/editar/remover serviço (403)', async () => {
    const cli = { nome: 'Cli', email: `cli${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
    await request(app).post('/auth/cadastrar').send(cli);
    const login = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
    const token = login.body.token;

    const res = await request(app).post('/servicos').set('Authorization', `Bearer ${token}`).send({ nome: 'X', duracao: 10, preco: 10, categoria: 'x' });
    expect(res.status).to.equal(403);
  });
});