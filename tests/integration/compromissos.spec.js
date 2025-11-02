const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/models/db');

describe('Compromissos integration', () => {
  beforeEach(() => db.reset());

  test('CT-Comp-01 - fluxo: cabeleireiro registra horário; cliente agenda; cliente vê compromisso', async () => {
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

  test('CT-Comp-06 - listar compromissos por usuário (cliente e cabeleireiro)', async () => {
    // preparar cabeleireiro
    const cabe = { nome: 'CComp', email: `ccomp${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
    await request(app).post('/auth/cadastrar').send(cabe);
    const loginC = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
    const tokenC = loginC.body.token;

    // registrar horario
    const dataHora = '2025-11-05T11:00:00Z';
    const reg = await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${tokenC}`).send({ dataHora });
    expect(reg.status).toBe(201);

    // criar cliente e logar
    const cli = { nome: 'ClienteX', email: `clix2${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
    await request(app).post('/auth/cadastrar').send(cli);
    const loginCli = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
    const tokenCli = loginCli.body.token;

    const servicoId = db.servicos[0].id;
    const cabeleireiroId = db.usuarios.find(u => u.papel === 'cabeleireiro' && u.email === cabe.email).id;

    // cliente agenda
    const ag = await request(app).post('/compromissos').set('Authorization', `Bearer ${tokenCli}`).send({ cabeleireiroId, servicoId, dataHora });
    expect(ag.status).toBe(201);

    // cliente lista
    const listCli = await request(app).get('/compromissos').set('Authorization', `Bearer ${tokenCli}`);
    expect(listCli.status).toBe(200);
    expect(listCli.body.some(c => c.id === ag.body.id)).toBe(true);

    // cabeleireiro lista
    const listCab = await request(app).get('/compromissos').set('Authorization', `Bearer ${tokenC}`);
    expect(listCab.status).toBe(200);
    expect(listCab.body.some(c => c.id === ag.body.id)).toBe(true);
  });
});
