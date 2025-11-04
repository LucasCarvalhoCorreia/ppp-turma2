// Testes de performance dos endpoints de `cabeleireiros/horarios`
// Endpoints testados por este script:
// - POST /cabeleireiros/horarios
// - GET  /cabeleireiros/horarios/{cabeleireiroId}
//
// Variáveis de ambiente usadas (opcionais):
// BASE_URL, CAB_EMAIL, CAB_SENHA, VUS_CREATE, VUS_LIST, DURATION
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    create: {
      executor: 'constant-vus',
      exec: 'create',
      vus: __ENV.VUS_CREATE ? parseInt(__ENV.VUS_CREATE) : 3,
      duration: __ENV.DURATION || '20s',
    },
    list: {
      executor: 'constant-vus',
      exec: 'list',
      vus: __ENV.VUS_LIST ? parseInt(__ENV.VUS_LIST) : 5,
      duration: __ENV.DURATION || '20s',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CABELEIREIRO_EMAIL = __ENV.CAB_EMAIL || 'cabeleireiro@salon.com';
const CABELEIREIRO_SENHA = __ENV.CAB_SENHA || 'senha123';

function getToken() {
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({ email: CABELEIREIRO_EMAIL, senha: CABELEIREIRO_SENHA }), { headers: { 'Content-Type': 'application/json' } });
  if (res.status === 200) {
    try { return JSON.parse(res.body).token; } catch (e) { return null; }
  }
  return null;
}

export function create() {
  // Método: POST /cabeleireiros/horarios
  const token = getToken();
  const payload = JSON.stringify({
    cabeleireiroId: 2,
    dataHora: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  });
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = http.post(`${BASE_URL}/cabeleireiros/horarios`, payload, { headers });
  check(res, { 'horarios create 201 or 401': (r) => r.status === 201 || r.status === 401 });
  sleep(1);
}

export function list() {
  // Método: GET /cabeleireiros/horarios/{cabeleireiroId}
  const res = http.get(`${BASE_URL}/cabeleireiros/horarios/2`);
  check(res, { 'horarios list 200 or 404': (r) => r.status === 200 || r.status === 404 });
  sleep(1);
}
