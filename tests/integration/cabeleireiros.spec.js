const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/models/db');

describe('Cabeleireiros integration', () => {
  beforeEach(() => db.reset());

  test('CT-Hor-02 - listar horários de um cabeleireiro', async () => {
    const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
    let r = await request(app).get(`/cabeleireiros/horarios/${cabe.id}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);

    const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha123' });
    const token = login.body.token;
    const dataHora = '2025-12-01T09:00:00Z';
    const reg = await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${token}`).send({ dataHora });
    expect(reg.status).toBe(201);

    r = await request(app).get(`/cabeleireiros/horarios/${cabe.id}`);
    expect(r.status).toBe(200);
    expect(r.body.some(h => h.dataHora === dataHora)).toBe(true);
  });

  test('CT-Hor-01 - registrar horário disponível (cabeleireiro) retorna 201 e adiciona ao DB', async () => {
    const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
    const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha123' });
    const token = login.body.token;
    const dataHora = '2025-12-02T14:00:00Z';

    const res = await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${token}`).send({ dataHora });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('dataHora', dataHora);

    // verifica que está no DB
    const lista = db.horariosDisponiveis.filter(h => h.cabeleireiroId === cabe.id && h.dataHora === dataHora);
    expect(lista.length).toBeGreaterThanOrEqual(1);
  });
});
