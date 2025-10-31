const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/models/db');

describe('Auth integration', () => {
  beforeEach(() => {
    // reinicializa o DB in-memory
    db.reset();
  });

  test('POST /auth/cadastrar -> cria usuário e POST /auth/login retorna token', async () => {
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
});
