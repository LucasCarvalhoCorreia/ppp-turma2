const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/models/db');
const { v4: uuidv4 } = require('uuid');

describe('GET /servicos/:id', () => {
  beforeEach(() => {
    // reinicia o DB para estado conhecido
    db.reset();
  });

  test('CT-Serv-07 - retorna 200 e o serviço quando id existe (happy path)', async () => {
    // usa o serviço seed inserido por db.reset()
    const existing = db.servicos[0];
    const res = await request(app).get(`/servicos/${existing.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', existing.id);
    expect(res.body).toHaveProperty('nome', existing.nome);
    expect(res.body).toHaveProperty('duracao');
    expect(res.body).toHaveProperty('preco');
    expect(res.body).toHaveProperty('categoria');
  });

  test('CT-Serv-08 - retorna 404 quando id não existe', async () => {
    const fakeId = uuidv4();
    const res = await request(app).get(`/servicos/${fakeId}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('erro');
    expect(res.body.erro).toMatch(/servi[cç]o não encontrado/i);
  });

  test('CT-Serv-09 - id malformado retorna 404 (implementação atual)', async () => {
    const badId = 'abc123';
    const res = await request(app).get(`/servicos/${badId}`);
    // Observação: a implementação atual não valida UUID e responde 404
    expect([400, 404]).toContain(res.status);
    // preferencialmente 404 com mensagem padrão
    if (res.status === 404) {
      expect(res.body).toHaveProperty('erro');
    }
  });
});
