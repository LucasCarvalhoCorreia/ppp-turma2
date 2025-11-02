const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/models/db');

describe('Serviços integration', () => {
  beforeEach(() => db.reset());

  test('CT-Serv-02 - POST /servicos com token de cabeleireiro cria serviço', async () => {
    const cabe = { nome: 'Cabele', email: `cab${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
    await request(app).post('/auth/cadastrar').send(cabe);
    const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
    const token = login.body.token;

    const res = await request(app).post('/servicos').set('Authorization', `Bearer ${token}`).send({ nome: 'Escova', duracao: 30, preco: 60, categoria: 'cabelo' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  test('CT-Serv-03 - POST /servicos sem token retorna 401', async () => {
    const res = await request(app).post('/servicos').send({ nome: 'X', duracao: 10, preco: 10, categoria: 'teste' });
    expect(res.status).toBe(401);
  });
});
