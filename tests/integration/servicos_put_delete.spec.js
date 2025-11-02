const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/models/db');

describe('Serviços - PUT/DELETE e autorização', () => {
  beforeEach(() => db.reset());

  test('CT-Serv-05 / CT-Serv-06 - cabeleireiro consegue atualizar e remover serviço', async () => {
    const cabe = { nome: 'Cabele', email: `cab${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
    await request(app).post('/auth/cadastrar').send(cabe);
    const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
    const token = login.body.token;

    // criar
    const res = await request(app).post('/servicos').set('Authorization', `Bearer ${token}`).send({ nome: 'Teste', duracao: 20, preco: 30, categoria: 'cabelo' });
    expect(res.status).toBe(201);
    const id = res.body.id;

    // atualizar
    const up = await request(app).put(`/servicos/${id}`).set('Authorization', `Bearer ${token}`).send({ preco: 40 });
    expect(up.status).toBe(200);
    expect(up.body.preco).toBe(40);

    // deletar
    const del = await request(app).delete(`/servicos/${id}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);
  });

  test('CT-Serv-04 - cliente não pode criar/editar/remover serviço (403)', async () => {
    const cli = { nome: 'Cli', email: `cli${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
    await request(app).post('/auth/cadastrar').send(cli);
    const login = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
    const token = login.body.token;

    const res = await request(app).post('/servicos').set('Authorization', `Bearer ${token}`).send({ nome: 'X', duracao: 10, preco: 10, categoria: 'x' });
    expect(res.status).toBe(403);
  });
});
