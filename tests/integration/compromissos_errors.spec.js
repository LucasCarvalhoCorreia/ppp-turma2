const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/models/db');
const { v4: uuidv4 } = require('uuid');

describe('Compromissos - casos de erro', () => {
  beforeEach(() => db.reset());

  test('CT-Comp-02 - agendar sem token retorna 401', async () => {
    const res = await request(app).post('/compromissos').send({ cabeleireiroId: 'x', servicoId: 'y', dataHora: '2025-11-01T10:00:00Z' });
    expect(res.status).toBe(401);
  });

  test('CT-Comp-04 - agendar com servico inválido retorna 400', async () => {
    // criar cliente e logar
    const cli = { nome: 'Cli', email: `cli${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
    await request(app).post('/auth/cadastrar').send(cli);
    const login = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
    const token = login.body.token;

    // cabeleireiro e horario
    const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
    const dataHora = '2025-11-01T12:00:00Z';
    db.horariosDisponiveis.push({ id: uuidv4(), cabeleireiroId: cabe.id, dataHora });

    const res = await request(app).post('/compromissos').set('Authorization', `Bearer ${token}`).send({ cabeleireiroId: cabe.id, servicoId: 'invalido', dataHora });
    expect(res.status).toBe(400);
  });

  test('CT-Comp-05 - agendar mesmo horário duas vezes (segundo falha)', async () => {
    // criar cliente e logar
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
    db.horariosDisponiveis.push({ id: uuidv4(), cabeleireiroId: cabe.id, dataHora });

    const r1 = await request(app).post('/compromissos').set('Authorization', `Bearer ${t1}`).send({ cabeleireiroId: cabe.id, servicoId: servico.id, dataHora });
    expect(r1.status).toBe(201);

    const r2 = await request(app).post('/compromissos').set('Authorization', `Bearer ${t2}`).send({ cabeleireiroId: cabe.id, servicoId: servico.id, dataHora });
    expect(r2.status).toBe(400);
  });
});
