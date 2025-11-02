const request = require('supertest');
const app = require('../../src/app');

describe('Security tests', () => {
  describe('Caminho infeliz', () => {
    test('CT-Security-01 - token inválido retorna 401 para rota protegida', async () => {
      const res = await request(app).post('/servicos').set('Authorization', 'Bearer invalid.token.here').send({ nome: 'X', duracao: 10, preco: 10, categoria: 'x' });
      expect(res.status).toBe(401);
    });
  });
});
