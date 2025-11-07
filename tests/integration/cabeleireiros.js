// -------------------------------------------------------------
// Suíte de Integração: Cabeleireiros (Horários)
//
// O que este arquivo cobre:
// - Registro de horário disponível por cabeleireiro (POST /cabeleireiros/horarios -> 201)
// - Listagem pública dos horários de um cabeleireiro (GET /cabeleireiros/horarios/{cabeleireiroId} -> 200)
// - Garantia de autorização: cliente não pode registrar horário (403)
//
// Detalhes de implementação:
// - Usa usuário seed de cabeleireiro para autenticar e registrar horários.
// - Após criar um horário, verifica persistência em db.horariosDisponiveis.
// - db.reset() garante ambiente limpo antes de cada teste.
// -------------------------------------------------------------
// Importa ferramentas de teste e o app express
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../src/app');
const db = require('../../src/models/db');

describe('Cabeleireiros', function () {
  // Timeout mais folgado para cobrir todo o fluxo
  this.timeout(15000);
  // Reset do DB antes de cada teste
  beforeEach(() => db.reset());

  it('CT-Hor-01 - registrar horário disponível (cabeleireiro) retorna 201 e adiciona ao DB', async () => {
    // Seleciona um cabeleireiro seed do DB
    const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
    // Faz login para obter token de cabeleireiro
    const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha123' });
    const token = login.body.token;
    // Define o horário a ser registrado
    const dataHora = '2025-12-02T14:00:00Z';

    // Registra horário via rota protegida
    const res = await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${token}`).send({ dataHora });
    // Espera 201 e dados do horário criado
    expect(res.status).to.equal(201);
    expect(res.body).to.have.property('id');
    expect(res.body).to.have.property('dataHora', dataHora);

    // Confirma persistência no DB em memória
    const lista = db.horariosDisponiveis.filter(h => h.cabeleireiroId === cabe.id && h.dataHora === dataHora);
    expect(lista.length).to.be.greaterThanOrEqual(1);
  });

  it('CT-Hor-02 - listar horários de um cabeleireiro', async () => {
    // Pega um cabeleireiro seed
    const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
    // Primeira listagem (pode estar vazia): deve retornar 200 e array
    let r = await request(app).get(`/cabeleireiros/horarios/${cabe.id}`);
    expect(r.status).to.equal(200);
    expect(r.body).to.be.an('array');

    // Registra um horário novo
    const login = await request(app).post('/auth/login').send({ email: cabe.email, senha: 'senha123' });
    const token = login.body.token;
    const dataHora = '2025-12-01T09:00:00Z';
    const reg = await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${token}`).send({ dataHora });
    expect(reg.status).to.equal(201);

    // Lista novamente e verifica se o horário está presente
    r = await request(app).get(`/cabeleireiros/horarios/${cabe.id}`);
    expect(r.status).to.equal(200);
    expect(r.body.some(h => h.dataHora === dataHora)).to.equal(true);
  });

  it('CT-Hor-03 - cliente não pode registrar horário (403)', async () => {
    // Cria um cliente e faz login
    const cli = { nome: 'ClienteErr', email: `clierr${Date.now()}@ex.com`, senha: 'senha', papel: 'cliente' };
    await request(app).post('/auth/cadastrar').send(cli);
    const login = await request(app).post('/auth/login').send({ email: cli.email, senha: 'senha' });
    const token = login.body.token;

    // Tenta registrar horário com token de cliente
    const dataHora = '2025-12-10T10:00:00Z';
    const res = await request(app).post('/cabeleireiros/horarios').set('Authorization', `Bearer ${token}`).send({ dataHora });
    // Deve retornar 403 (papel insuficiente)
    expect(res.status).to.equal(403);
    expect(res.body).to.have.property('erro');

    // Garante que o horário não foi salvo indevidamente
    const cabe = db.usuarios.find(u => u.papel === 'cabeleireiro');
    const found = db.horariosDisponiveis.find(h => h.cabeleireiroId === (cabe && cabe.id) && h.dataHora === dataHora);
    expect(found).to.equal(undefined);
  });
});
