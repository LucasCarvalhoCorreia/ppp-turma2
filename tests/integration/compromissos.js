// -------------------------------------------------------------
// Suíte de Integração: Compromissos (Agendamentos)
//
// O que este arquivo cobre:
// - Fluxo completo: cabeleireiro registra horário -> cliente agenda -> cliente lista compromissos (201/200)
// - Erros comuns: falta de token (401), horário indisponível (400), serviço inválido (400)
// - Conflito de agendamento: segundo cliente não consegue agendar mesmo horário (400 na implementação atual)
//
// Detalhes de implementação:
// - Gera tokens distintos para cabeleireiro e cliente e reaproveita para as chamadas.
// - Quando não há serviços cadastrados, cria um de apoio via POST /servicos (com token de cabeleireiro).
// - db.reset() antes de cada teste para simular ambiente fresco e determinístico.
// -------------------------------------------------------------
// Importações básicas de teste e banco em memória
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../src/app');
const db = require('../../src/models/db');

describe('Compromissos', function () {
  // Timeout de 20s dado o fluxo mais longo
  this.timeout(20000);
  // Reset do DB para cada teste
  beforeEach(() => db.reset());

  it('CT-Comp-01 - fluxo: cabeleireiro registra horário; cliente agenda; cliente vê compromisso', async () => {
    // cria cabeleireiro e horário
    const cab = { nome: 'Cab', email: `cab_${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
    // cadastra cabeleireiro
    await request(app).post('/auth/cadastrar').send(cab);
    // autentica cabeleireiro para obter token
    const cabLogin = await request(app).post('/auth/login').send({ email: cab.email, senha: 'senha' });
    const cabToken = cabLogin.body.token;

    // agenda um horário futuro em ISO (exato, pois a checagem é string match)
    const dataHora = new Date(Date.now() + 7200_000).toISOString();
    // registra o horário disponível para o cabeleireiro
    await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${cabToken}`).send({ dataHora });

    // cria cliente
    const cli = { nome: 'Cli', email: `cli_${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
    // cadastra cliente
    await request(app).post('/auth/cadastrar').send(cli);
    // autentica cliente
    const cliLogin = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
    const cliToken = cliLogin.body.token;

    // garante um serviço
    let servId;
    // tenta listar serviços existentes
    const servList = await request(app).get('/servicos');
    if (Array.isArray(servList.body) && servList.body.length > 0) {
      // se já existe, usa o primeiro
      servId = servList.body[0].id;
    } else {
      // se não existe, cria um serviço com token de cabeleireiro
      const sres = await request(app)
        .post('/servicos')
        .set('Authorization', `Bearer ${cabToken}`)
        .send({ nome: 'Corte', duracao: 30, preco: 50, categoria: 'cabelo' });
      servId = sres.body.id;
    }

    // cria o compromisso usando o token do cliente (rota protegida a clientes)
    const create = await request(app)
      .post('/compromissos')
      .set('Authorization', `Bearer ${cliToken}`)
      .send({ cabeleireiroId: db.usuarios.find(u => u.email === cab.email).id, servicoId: servId, dataHora });

    // espera 201 (criado)
    expect(create.status).to.equal(201);

    // lista compromissos do cliente autenticado
    const list = await request(app)
      .get('/compromissos')
      .set('Authorization', `Bearer ${cliToken}`);
    // espera 200 e um array de compromissos
    expect(list.status).to.equal(200);
    expect(list.body).to.be.an('array');
  });

  it('CT-Comp-02 - agendar sem token retorna 401', async () => {
    // tenta criar compromisso sem Authorization
    const res = await request(app).post('/compromissos').send({ cabeleireiroId: 'x', servicoId: 'y', dataHora: '2025-11-01T10:00:00Z' });
    // espera 401
    expect(res.status).to.equal(401);
  });

  it('CT-Comp-03 - agendar horário indisponível retorna 400 (caso isolado)', async () => {
    // cria cliente e autentica
    const cli = { nome: 'CliZ', email: `cliz${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
    await request(app).post('/auth/cadastrar').send(cli);
    const login = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
    const token = login.body.token;

    // escolhe um cabeleireiro seed e um serviço existente
    const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
    const servicoId = db.servicos[0].id;
    // define um horário que não está na lista de disponíveis
    const dataHora = '2040-01-01T00:00:00Z';

    // tenta criar compromisso com horário não registrado -> 400 esperado
    const res = await request(app)
      .post('/compromissos')
      .set('Authorization', `Bearer ${token}`)
      .send({ cabeleireiroId: cabe.id, servicoId, dataHora });
    expect(res.status).to.equal(400);
    expect(res.body).to.have.property('erro');
  });

  it('CT-Comp-04 - agendar com servico inválido retorna 400', async () => {
    // cria cliente e autentica
    const cli = { nome: 'Cli', email: `cli${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
    await request(app).post('/auth/cadastrar').send(cli);
    const login = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
    const token = login.body.token;

    // seleciona cabeleireiro seed e registra um horário válido
    const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
    const dataHora = '2025-11-01T12:00:00Z';
    const { v4: uuidv4 } = require('uuid');
    db.horariosDisponiveis.push({ id: uuidv4(), cabeleireiroId: cabe.id, dataHora });

    // tenta agendar usando servicoId inválido -> 400 esperado
    const res = await request(app)
      .post('/compromissos')
      .set('Authorization', `Bearer ${token}`)
      .send({ cabeleireiroId: cabe.id, servicoId: 'invalido', dataHora });
    expect(res.status).to.equal(400);
  });

  it('CT-Comp-05 - agendar mesmo horário duas vezes (segundo falha)', async () => {
    // cria dois clientes e autentica ambos
    const cli1 = { nome: 'C1', email: `c1${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
    const cli2 = { nome: 'C2', email: `c2${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
    await request(app).post('/auth/cadastrar').send(cli1);
    await request(app).post('/auth/cadastrar').send(cli2);
    const l1 = await request(app).post('/auth/login').send({ email: cli1.email, senha: 'senha' });
    const l2 = await request(app).post('/auth/login').send({ email: cli2.email, senha: 'senha' });
    const t1 = l1.body.token;
    const t2 = l2.body.token;

    // escolhe um cabeleireiro seed e um serviço existente; registra um único horário
    const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
    const servico = db.servicos[0];
    const dataHora = '2025-11-02T09:00:00Z';
    const { v4: uuidv4 } = require('uuid');
    db.horariosDisponiveis.push({ id: uuidv4(), cabeleireiroId: cabe.id, dataHora });

    // primeiro cliente agenda com sucesso (201)
    const r1 = await request(app)
      .post('/compromissos')
      .set('Authorization', `Bearer ${t1}`)
      .send({ cabeleireiroId: cabe.id, servicoId: servico.id, dataHora });
    expect(r1.status).to.equal(201);

    // segundo cliente tenta o mesmo horário -> 400 esperado (indisponível)
    const r2 = await request(app)
      .post('/compromissos')
      .set('Authorization', `Bearer ${t2}`)
      .send({ cabeleireiroId: cabe.id, servicoId: servico.id, dataHora });
    expect(r2.status).to.equal(400);
  });
});
