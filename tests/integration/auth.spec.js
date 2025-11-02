const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/models/db');

describe('Auth integration', () => {
  beforeEach(() => {
    // reinicializa o DB in-memory
    db.reset();
  });

  test('CT-Auth-01 / CT-Auth-03 - POST /auth/cadastrar cria usuário e POST /auth/login retorna token', async () => {
    const email = `test-${Date.now()}@example.com`;
    const usuario = { nome: 'Teste', email, senha: 'senha123', papel: 'cliente' };

    const resCad = await request(app).post('/auth/cadastrar').send(usuario);
    expect(resCad.status).toBe(201);
    expect(resCad.body).toHaveProperty('id');
    expect(resCad.body).not.toHaveProperty('senha');

    const resLogin = await request(app).post('/auth/login').send({ email, senha: 'senha123' });
    expect(resLogin.status).toBe(200);
    expect(resLogin.body).toHaveProperty('token');
  });

  test('CT-Auth-03 - login válido retorna token (caso separado)', async () => {
    const email = `valid-${Date.now()}@example.com`;
    const usuario = { nome: 'Valido', email, senha: 'senha123', papel: 'cliente' };

    const resCad = await request(app).post('/auth/cadastrar').send(usuario);
    expect(resCad.status).toBe(201);

    const resLogin = await request(app).post('/auth/login').send({ email, senha: 'senha123' });
    expect(resLogin.status).toBe(200);
    expect(resLogin.body).toHaveProperty('token');
  });

  test('CT-Auth-02 - cadastro com email duplicado retorna 400', async () => {
    const payload = { nome: 'Dup', email: `dup${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
    const r1 = await request(app).post('/auth/cadastrar').send(payload);
    expect(r1.status).toBe(201);

    const r2 = await request(app).post('/auth/cadastrar').send(payload);
    expect(r2.status).toBe(400);
    expect(r2.body).toHaveProperty('erro');
    expect(r2.body.erro).toMatch(/email já cadastrado/i);
  });

  test('CT-Auth-04 - login inválido retorna 401', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'noone@example.com', senha: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('erro');
  });
});
