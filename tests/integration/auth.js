// -------------------------------------------------------------
// Suíte de Integração: Auth
//
// O que este arquivo cobre:
// - Cadastro de usuário (cliente) em POST /auth/cadastrar (201)
// - Login válido em POST /auth/login (200) retornando token JWT
// - Erro de e-mail duplicado (400)
// - Erro de credenciais inválidas (401)
//
// Detalhes de implementação:
// - Usa Supertest para chamar a API e Chai (expect) para assertivas.
// - db.reset() é executado antes de cada teste para garantir isolamento.
// - Valida que a senha não é retornada no payload de cadastro.
// -------------------------------------------------------------
// Importa o supertest para simular chamadas HTTP contra a app Express
const request = require('supertest');
// Importa 'expect' do Chai para escrever asserções legíveis
const { expect } = require('chai');
// Importa a aplicação Express configurada
const app = require('../../src/app');
// Importa o DB em memória para reset entre testes
const db = require('../../src/models/db');

describe('Auth', function () {
  // Ajusta o timeout padrão dos testes desta suíte para 10s
  this.timeout(10000);
  // Antes de cada teste, reinicia o banco em memória para isolamento
  beforeEach(() => db.reset());

  it('CT-Auth-01 - POST /auth/cadastrar cria usuário e POST /auth/login retorna token', async () => {
    // Gera um e-mail único para evitar colisões entre execuções
    const email = `test-${Date.now()}@example.com`;
    // Monta o payload de cadastro de cliente
    const usuario = { nome: 'Teste', email, senha: 'senha123', papel: 'cliente' };

    // Executa cadastro de usuário
    const resCad = await request(app).post('/auth/cadastrar').send(usuario);
    // Espera status 201 (criado)
    expect(resCad.status).to.equal(201);
    // Deve retornar um id gerado
    expect(resCad.body).to.have.property('id');
    // E não deve retornar o campo senha
    expect(resCad.body).to.not.have.property('senha');

    // Realiza login com as mesmas credenciais
    const resLogin = await request(app).post('/auth/login').send({ email, senha: 'senha123' });
    // Espera status 200 (ok)
    expect(resLogin.status).to.equal(200);
    // E um token JWT no corpo
    expect(resLogin.body).to.have.property('token');
  });

  it('CT-Auth-03 - login válido retorna token (caso separado)', async () => {
    // Prepara outro e-mail único para este caso
    const email = `valid-${Date.now()}@example.com`;
    // Payload de cadastro
    const usuario = { nome: 'Valido', email, senha: 'senha123', papel: 'cliente' };

    // Cadastra usuário
    const resCad = await request(app).post('/auth/cadastrar').send(usuario);
    // Status 201 esperado
    expect(resCad.status).to.equal(201);

    // Faz login com o usuário criado
    const resLogin = await request(app).post('/auth/login').send({ email, senha: 'senha123' });
    // Espera 200 e token
    expect(resLogin.status).to.equal(200);
    expect(resLogin.body).to.have.property('token');
  });

  it('CT-Auth-02 - cadastro com email duplicado retorna 400', async () => {
    // Prepara um payload com e-mail único
    const payload = { nome: 'Dup', email: `dup${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
    // Primeiro cadastro deve criar com sucesso
    const r1 = await request(app).post('/auth/cadastrar').send(payload);
    expect(r1.status).to.equal(201);

    // Tentar cadastrar novamente com o mesmo e-mail deve falhar (400)
    const r2 = await request(app).post('/auth/cadastrar').send(payload);
    expect(r2.status).to.equal(400);
    // A resposta deve conter a chave 'erro'
    expect(r2.body).to.have.property('erro');
    // E a mensagem deve indicar e-mail já cadastrado (variações aceitas)
    expect(String(r2.body.erro).toLowerCase()).to.match(/email já cadastrado|email ja cadastrado/);
  });

  it('CT-Auth-04 - login inválido retorna 401', async () => {
    // Tenta logar com credenciais inexistentes/erradas
    const res = await request(app).post('/auth/login').send({ email: 'noone@example.com', senha: 'wrong' });
    // Espera 401 (não autorizado)
    expect(res.status).to.equal(401);
    // E presença de mensagem de erro
    expect(res.body).to.have.property('erro');
  });
});
