// -------------------------------------------------------------
// Suíte de Integração: Segurança (Autorização)
//
// O que este arquivo cobre:
// - Envio de token inválido em rota protegida deve resultar em 401.
//
// Detalhes de implementação:
// - Teste simples com Bearer inválido em POST /servicos.
// - Útil para validar o middleware de autenticação JWT.
// -------------------------------------------------------------
// Importa ferramentas de teste e a app express
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../src/app');

describe('Seguranca', function () {
  // Ajusta timeout para 10s nesta suíte
  this.timeout(10000);

  it('CT-Security-01 - token inválido retorna 401 para rota protegida', async () => {
    // Chama rota protegida enviando um token claramente inválido
    const res = await request(app)
      .post('/servicos')
      .set('Authorization', 'Bearer invalid.token.here')
      .send({ nome: 'X', duracao: 10, preco: 10, categoria: 'x' });
    // Espera 401 (falha de autenticação)
    expect(res.status).to.equal(401);
  });
});
