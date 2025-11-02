import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    cadastrar: {
      executor: 'constant-vus',
      exec: 'cadastrar',
      vus: __ENV.VUS_CAD ? parseInt(__ENV.VUS_CAD) : 5,
      duration: __ENV.DURATION || '20s',
    },
    login: {
      executor: 'constant-vus',
      exec: 'login',
      vus: __ENV.VUS_LOGIN ? parseInt(__ENV.VUS_LOGIN) : 5,
      duration: __ENV.DURATION || '20s',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export function cadastrar() {
  const random = Math.floor(Math.random() * 1000000);
  const payload = JSON.stringify({
    nome: `CTUser ${random}`,
    email: `ctuser+${random}@example.com`,
    senha: 'senha123',
    papel: Math.random() > 0.5 ? 'cliente' : 'cabeleireiro',
  });
  const res = http.post(`${BASE_URL}/auth/cadastrar`, payload, { headers: { 'Content-Type': 'application/json' } });
  check(res, { 'cadastrar 201 or 400': (r) => r.status === 201 || r.status === 400 });
  sleep(1);
}

export function login() {
  const email = __ENV.LOGIN_EMAIL || 'joana@cliente.com';
  const senha = __ENV.LOGIN_SENHA || 'senha123';
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({ email, senha }), { headers: { 'Content-Type': 'application/json' } });
  check(res, { 'login 200': (r) => r.status === 200 });
  sleep(1);
}
