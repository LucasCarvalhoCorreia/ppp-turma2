const request = require('supertest');
const { expect } = require('chai');
const app = require('../../src/app');
const db = require('../../src/models/db');

describe('Cabeleireiros', function () {
  this.timeout(15000);
  beforeEach(() => db.reset());

  it('CT-Hor-01 - registrar horário disponível (cabeleireiro) retorna 201 e adiciona ao DB', async () => {
    const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
    const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha123' });
    const token = login.body.token;
    const dataHora = '2025-12-02T14:00:00Z';

    const res = await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${token}`).send({ dataHora });
    expect(res.status).to.equal(201);
    expect(res.body).to.have.property('id');
    expect(res.body).to.have.property('dataHora', dataHora);

    const lista = db.horariosDisponiveis.filter(h => h.cabeleireiroId === cabe.id && h.dataHora === dataHora);
    expect(lista.length).to.be.greaterThanOrEqual(1);
  });

  it('CT-Hor-02 - listar horários de um cabeleireiro', async () => {
    const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
    let r = await request(app).get(`/cabeleireiros/horarios/${cabe.id}`);
    expect(r.status).to.equal(200);
    expect(r.body).to.be.an('array');

    const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha123' });
    const token = login.body.token;
    const dataHora = '2025-12-01T09:00:00Z';
    const reg = await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${token}`).send({ dataHora });
    expect(reg.status).to.equal(201);

    r = await request(app).get(`/cabeleireiros/horarios/${cabe.id}`);
    expect(r.status).to.equal(200);
    expect(r.body.some(h => h.dataHora === dataHora)).to.equal(true);
  });

  it('CT-Hor-03 - cliente não pode registrar horário (403)', async () => {
    const cli = { nome: 'ClienteErr', email: `clierr${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
    await request(app).post('/auth/cadastrar').send(cli);
    const login = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
    const token = login.body.token;

    const dataHora = '2025-12-10T10:00:00Z';
    const res = await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${token}`).send({ dataHora });
    expect(res.status).to.equal(403);
    expect(res.body).to.have.property('erro');

    const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
    const found = db.horariosDisponiveis.find(h => h.cabeleireiroId === (cabe && cabe.id) && h.dataHora === dataHora);
    expect(found).to.equal(undefined);
  });
});
