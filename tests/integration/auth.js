const request = require('supertest');
const { expect } = require('chai');
const app = require('../../src/app');
const db = require('../../src/models/db');

describe('Auth', function () {
  this.timeout(10000);
  beforeEach(() => db.reset());

  it('CT-Auth-01 - POST /auth/cadastrar cria usuário e POST /auth/login retorna token', async () => {
    const email = `test-${Date.now()}@example.com`;
    const usuario = { nome: 'Teste', email, senha: 'senha123', papel: 'cliente' };

    const resCad = await request(app).post('/auth/cadastrar').send(usuario);
    expect(resCad.status).to.equal(201);
    expect(resCad.body).to.have.property('id');
    expect(resCad.body).to.not.have.property('senha');

    const resLogin = await request(app).post('/auth/login').send({ email, senha: 'senha123' });
    expect(resLogin.status).to.equal(200);
    expect(resLogin.body).to.have.property('token');
  });

  it('CT-Auth-03 - login válido retorna token (caso separado)', async () => {
    const email = `valid-${Date.now()}@example.com`;
    const usuario = { nome: 'Valido', email, senha: 'senha123', papel: 'cliente' };

    const resCad = await request(app).post('/auth/cadastrar').send(usuario);
    expect(resCad.status).to.equal(201);

    const resLogin = await request(app).post('/auth/login').send({ email, senha: 'senha123' });
    expect(resLogin.status).to.equal(200);
    expect(resLogin.body).to.have.property('token');
  });

  it('CT-Auth-02 - cadastro com email duplicado retorna 400', async () => {
    const payload = { nome: 'Dup', email: `dup${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
    const r1 = await request(app).post('/auth/cadastrar').send(payload);
    expect(r1.status).to.equal(201);

    const r2 = await request(app).post('/auth/cadastrar').send(payload);
    expect(r2.status).to.equal(400);
    expect(r2.body).to.have.property('erro');
    expect(String(r2.body.erro).toLowerCase()).to.match(/email já cadastrado|email ja cadastrado/);
  });

  it('CT-Auth-04 - login inválido retorna 401', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'noone@example.com', senha: 'wrong' });
    expect(res.status).to.equal(401);
    expect(res.body).to.have.property('erro');
  });
});
