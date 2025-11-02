import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    create: {
      executor: 'constant-vus',
      exec: 'create',
      vus: __ENV.VUS_CREATE ? parseInt(__ENV.VUS_CREATE) : 5,
      duration: __ENV.DURATION || '20s',
    },
    list: {
      executor: 'constant-vus',
      exec: 'list',
      vus: __ENV.VUS_LIST ? parseInt(__ENV.VUS_LIST) : 10,
      duration: __ENV.DURATION || '20s',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CLIENT_EMAIL = __ENV.CLIENT_EMAIL || 'joana@cliente.com';
const CLIENT_SENHA = __ENV.CLIENT_SENHA || 'senha123';

function getToken() {
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({ email: CLIENT_EMAIL, senha: CLIENT_SENHA }), { headers: { 'Content-Type': 'application/json' } });
  if (res.status === 200) {
    try { return JSON.parse(res.body).token; } catch (e) { return null; }
  }
  return null;
}

export function create() {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const payload = JSON.stringify({
    servicoId: 1,
    horarioId: 1,
  });
  const res = http.post(`${BASE_URL}/compromissos`, payload, { headers });
  check(res, { 'compromissos create 201 or 401 or 400': (r) => [201, 401, 400].includes(r.status) });
  sleep(1);
}

export function list() {
  const token = getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = http.get(`${BASE_URL}/compromissos`, { headers });
  check(res, { 'compromissos list 200 or 401': (r) => [200, 401].includes(r.status) });
  sleep(1);
}
