const request = require('supertest');
const { expect } = require('chai');
const app = require('../../src/app');

describe('Seguranca', function () {
  this.timeout(10000);

  it('CT-Security-01 - token inválido retorna 401 para rota protegida', async () => {
    const res = await request(app)
      .post('/servicos')
      .set('Authorization', 'Bearer invalid.token.here')
      .send({ nome: 'X', duracao: 10, preco: 10, categoria: 'x' });
    expect(res.status).to.equal(401);
  });
});
