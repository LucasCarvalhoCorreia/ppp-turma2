const authService = require('../../../src/services/authService');
const db = require('../../../src/models/db');

describe('authService (unit)', () => {
  beforeEach(() => db.reset());

  test('cadastrar falha quando email duplicado', () => {
    const u = { nome: 'X', email: 'dup@example.com', senha: 's', papel: 'cliente' };
    authService.cadastrar(u);
    expect(() => authService.cadastrar(u)).toThrow(/Email já cadastrado/);
  });

  test('login falha com credenciais inválidas', () => {
    expect(() => authService.login({ email: 'noone@example.com', senha: 'x' })).toThrow(/Credenciais inválidas/);
  });
});
