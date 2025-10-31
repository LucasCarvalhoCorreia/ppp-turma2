const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/models/db');

describe('Compromissos integration', () => {
  beforeEach(() => db.reset());

  test('fluxo: cabeleireiro registra horário; cliente agenda; cliente vê compromisso', async () => {
    // criar cabeleireiro e logar
    const cabe = { nome: 'Cabele', email: `cab${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
    await request(app).post('/auth/cadastrar').send(cabe);
    const loginC = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
    const tokenC = loginC.body.token;

    // registrar horário
    const dataHora = '2025-11-01T10:00:00Z';
    const reg = await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${tokenC}`).send({ dataHora });
    expect(reg.status).toBe(201);

    // criar cliente e logar
    const cli = { nome: 'Cliente', email: `cli${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
    await request(app).post('/auth/cadastrar').send(cli);
    const loginCli = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
    const tokenCli = loginCli.body.token;

    // usar servico já existente (seed)
    const servicoId = db.servicos[0].id;
    const cabeleireiroId = db.usuarios.find(u => u.papel === 'cabeleireiro' && u.email === cabe.email).id;

    // cliente agenda
    const ag = await request(app).post('/compromissos').set('Authorization', `Bearer ${tokenCli}`).send({ cabeleireiroId, servicoId, dataHora });
    expect(ag.status).toBe(201);

    // cliente lista compromissos
    const lista = await request(app).get('/compromissos').set('Authorization', `Bearer ${tokenCli}`);
    expect(lista.status).toBe(200);
    expect(Array.isArray(lista.body)).toBe(true);
    expect(lista.body.find(c => c.id === ag.body.id)).toBeDefined();
  });
});
