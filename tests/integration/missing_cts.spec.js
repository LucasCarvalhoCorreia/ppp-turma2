const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/models/db');
const { v4: uuidv4 } = require('uuid');

describe('Automatização de casos faltantes (CTs)', () => {
  beforeEach(() => db.reset());

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

  test('CT-Serv-01 - GET /servicos retorna array e 200', async () => {
    const res = await request(app).get('/servicos');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('CT-Hor-02 - listar horários de um cabeleireiro', async () => {
    // pegar cabeleireiro seed
    const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
    // inicialmente vazio
    let r = await request(app).get(`/cabeleireiros/horarios/${cabe.id}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);

    // registrar horario via service (simulate cabeleireiro)
    const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha123' });
    const token = login.body.token;
    const dataHora = '2025-12-01T09:00:00Z';
    const reg = await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${token}`).send({ dataHora });
    expect(reg.status).toBe(201);

    r = await request(app).get(`/cabeleireiros/horarios/${cabe.id}`);
    expect(r.status).toBe(200);
    expect(r.body.some(h => h.dataHora === dataHora)).toBe(true);
  });

  test('CT-Comp-03 - agendar horário indisponível retorna 400', async () => {
    // criar cliente e tentar agendar sem horario registrado
    const cli = { nome: 'CliX', email: `clix${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
    await request(app).post('/auth/cadastrar').send(cli);
    const login = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
    const token = login.body.token;

    const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
    const servicoId = db.servicos[0].id;
    const dataHora = '2030-01-01T00:00:00Z'; // data que não existe em horariosDisponiveis

    const res = await request(app).post('/compromissos').set('Authorization', `Bearer ${token}`).send({ cabeleireiroId: cabe.id, servicoId, dataHora });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('erro');
    expect(res.body.erro).toMatch(/hor[iá]rio não disponível/i);
  });

  test('CT-Security-01 - token inválido retorna 401 para rota protegida', async () => {
    const res = await request(app).post('/servicos').set('Authorization', 'Bearer invalid.token.here').send({ nome: 'X', duracao: 10, preco: 10, categoria: 'x' });
    expect(res.status).toBe(401);
  });
});
