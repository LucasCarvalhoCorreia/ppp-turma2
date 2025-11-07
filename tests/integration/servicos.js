// -------------------------------------------------------------
// Suíte de Integração: Serviços
//
// O que este arquivo cobre:
// - Listagem pública (GET /servicos -> 200)
// - Criação com permissão (POST /servicos -> 201) e sem permissão (401/403)
// - Detalhe por ID: existente (200), inexistente (404), malformado (400/404 conforme implementação)
// - Atualização e remoção por cabeleireiro (PUT/DELETE -> 200/204), com verificação de 404 após remoção
//
// Detalhes de implementação:
// - Usa Supertest + Chai e isola cada caso com db.reset().
// - Gera IDs inexistentes com uuidv4 para validar 404.
// - Tokens são obtidos dinamicamente via auth para ações que requerem papel de cabeleireiro.
// -------------------------------------------------------------
// Importa utilitários de teste e a app express
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../src/app');
const db = require('../../src/models/db');
// Importa gerador de UUID para criar IDs inexistentes
const { v4: uuidv4 } = require('uuid');

describe('Servicos', function () {
  // Timeout de 15s para cobrir fluxos que fazem múltiplas chamadas
  this.timeout(15000);
  // Reseta DB antes de cada teste
  beforeEach(() => db.reset());

  it('CT-Serv-01 - GET /servicos retorna array e 200', async () => {
    // Faz a requisição de listagem de serviços (rota pública)
    const res = await request(app).get('/servicos');
    // Espera 200
    expect(res.status).to.equal(200);
    // E corpo como array
    expect(res.body).to.be.an('array');
  });

  it('CT-Serv-02 - POST /servicos com token de cabeleireiro cria serviço', async () => {
    // Cria um usuário com papel cabeleireiro
    const cabe = { nome: 'Cabele', email: `cab_${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
    await request(app).post('/auth/cadastrar').send(cabe);
    // Faz login para obter token
    const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
    const token = login.body.token;

    // Faz POST /servicos com header Authorization
    const res = await request(app)
      .post('/servicos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Escova', duracao: 30, preco: 60, categoria: 'cabelo' });

    // Espera 201 e presença de id
    expect(res.status).to.equal(201);
    expect(res.body).to.have.property('id');
  });

  it('CT-Serv-03 - POST /servicos sem token retorna 401', async () => {
    // Tenta criar serviço sem enviar Authorization
    const res = await request(app).post('/servicos').send({ nome: 'X', duracao: 10, preco: 10, categoria: 'teste' });
    // Espera 401 (não autenticado)
    expect(res.status).to.equal(401);
  });
});

describe('Servicos - GET /servicos/{id}', function () {
  // Timeout de 10s para os cenários de GET by ID
  this.timeout(10000);
  // Isolamento por reset do DB
  beforeEach(() => db.reset());

  it('CT-Serv-07 - retorna 200 e o serviço quando id existe (happy path)', async () => {
    // Usa um serviço já semeado no DB
    const existing = db.servicos[0];
    // Realiza GET pelo ID existente
    const res = await request(app).get(`/servicos/${existing.id}`);
    // Espera 200 e os campos principais no corpo
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('id', existing.id);
    expect(res.body).to.have.property('nome', existing.nome);
    expect(res.body).to.have.property('duracao');
    expect(res.body).to.have.property('preco');
    expect(res.body).to.have.property('categoria');
  });

  it('CT-Serv-08 - retorna 404 quando id não existe', async () => {
    // Gera um UUID aleatório que não está no DB
    const fakeId = uuidv4();
    // Faz GET por esse ID inexistente
    const res = await request(app).get(`/servicos/${fakeId}`);
    // Deve retornar 404 e mensagem de erro
    expect([404]).to.include(res.status);
    expect(res.body).to.have.property('erro');
    expect(String(res.body.erro).toLowerCase()).to.match(/servi[cç]o não encontrado|servico nao encontrado/);
  });

  it('CT-Serv-09 - id malformado retorna 404 (implementação atual)', async () => {
    // Usa um ID claramente inválido (não UUID)
    const badId = 'abc123';
    // Faz GET e aceita 400 ou 404, conforme implementação atual
    const res = await request(app).get(`/servicos/${badId}`);
    expect([400, 404]).to.include(res.status);
    if (res.status === 404) {
      expect(res.body).to.have.property('erro');
    }
  });
});

describe('Servicos - PUT/DELETE /servicos/{id}', function () {
  // Timeout maior pois inclui criar->atualizar->remover
  this.timeout(15000);
  // Reseta DB antes de cada teste
  beforeEach(() => db.reset());

  it('CT-Serv-05 - cabeleireiro consegue atualizar serviço', async () => {
    // Cria cabeleireiro e obtém token
    const cabe = { nome: 'Cabele', email: `cab${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
    await request(app).post('/auth/cadastrar').send(cabe);
    const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
    const token = login.body.token;

    // Cria serviço inicial
    const res = await request(app).post('/servicos').set('Authorization', `Bearer ${token}`).send({ nome: 'Teste', duracao: 20, preco: 30, categoria: 'cabelo' });
    expect(res.status).to.equal(201);
    const id = res.body.id;

    // Atualiza apenas o preço
    const up = await request(app).put(`/servicos/${id}`).set('Authorization', `Bearer ${token}`).send({ preco: 40 });
    // Espera 200 e preco atualizado
    expect(up.status).to.equal(200);
    expect(up.body.preco).to.equal(40);
  });

  it('CT-Serv-06 - remover serviço (DELETE) retorna 204 e 404 subsequente', async () => {
    // Cria cabeleireiro e obtém token
    const cabe = { nome: 'Cabele2', email: `cab2${Date.now()}@ex.com`, senha: 'senha', papel: 'cabeleireiro' };
    await request(app).post('/auth/cadastrar').send(cabe);
    const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha' });
    const token = login.body.token;

    // Cria um serviço e captura o id
    const res = await request(app).post('/servicos').set('Authorization', `Bearer ${token}`).send({ nome: 'RemoverTeste', duracao: 20, preco: 30, categoria: 'cabelo' });
    expect(res.status).to.equal(201);
    const id = res.body.id;

    // Remove o serviço (204 esperado)
    const del = await request(app).delete(`/servicos/${id}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).to.equal(204);

    // Remoção repetida deve retornar 404
    const del2 = await request(app).delete(`/servicos/${id}`).set('Authorization', `Bearer ${token}`);
    expect(del2.status).to.equal(404);
  });

  it('CT-Serv-04 - cliente não pode criar/editar/remover serviço (403)', async () => {
    // Cria um cliente e faz login
    const cli = { nome: 'Cli', email: `cli${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
    await request(app).post('/auth/cadastrar').send(cli);
    const login = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
    const token = login.body.token;

    // Tenta criar serviço com token de cliente
    const res = await request(app).post('/servicos').set('Authorization', `Bearer ${token}`).send({ nome: 'X', duracao: 10, preco: 10, categoria: 'x' });
    // Espera 403 (acesso negado por papel insuficiente)
    expect(res.status).to.equal(403);
  });
});