import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    list: {
      executor: 'constant-vus',
      exec: 'list',
      vus: __ENV.VUS_LIST ? parseInt(__ENV.VUS_LIST) : 5,
      duration: __ENV.DURATION || '20s',
    },
    create: {
      executor: 'constant-vus',
      exec: 'create',
      vus: __ENV.VUS_CREATE ? parseInt(__ENV.VUS_CREATE) : 2,
      duration: __ENV.DURATION || '20s',
    },
    getById: {
      executor: 'constant-vus',
      exec: 'getById',
      vus: __ENV.VUS_GET ? parseInt(__ENV.VUS_GET) : 3,
      duration: __ENV.DURATION || '20s',
    },
    update: {
      executor: 'constant-vus',
      exec: 'update',
      vus: __ENV.VUS_UPDATE ? parseInt(__ENV.VUS_UPDATE) : 2,
      duration: __ENV.DURATION || '20s',
    },
    remove: {
      executor: 'constant-vus',
      exec: 'remove',
      vus: __ENV.VUS_DELETE ? parseInt(__ENV.VUS_DELETE) : 1,
      duration: __ENV.DURATION || '20s',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'cabeleireiro@salon.com';
const ADMIN_SENHA = __ENV.ADMIN_SENHA || 'senha123';

function getAuthToken() {
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({ email: ADMIN_EMAIL, senha: ADMIN_SENHA }), { headers: { 'Content-Type': 'application/json' } });
  if (res.status === 200) {
    try {
      return JSON.parse(res.body).token;
    } catch (e) {
      return null;
    }
  }
  return null;
}

export function list() {
  const res = http.get(`${BASE_URL}/servicos`);
  check(res, { 'list 200': (r) => r.status === 200 });
  sleep(1);
}

export function create() {
  const token = getAuthToken();
  const payload = JSON.stringify({ nome: `Corte ${Math.floor(Math.random()*10000)}`, duracaoMinutos: 30, preco: 50 });
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = http.post(`${BASE_URL}/servicos`, payload, { headers });
  check(res, { 'create 201 or 401': (r) => r.status === 201 || r.status === 401 });
  sleep(1);
}

export function getById() {
  // attempt to get id=1 as a simple heuristic
  const res = http.get(`${BASE_URL}/servicos/1`);
  check(res, { 'getById 200 or 404': (r) => r.status === 200 || r.status === 404 });
  sleep(1);
}

export function update() {
  const token = getAuthToken();
  const payload = JSON.stringify({ nome: `Corte Editado ${Math.floor(Math.random()*10000)}`, duracaoMinutos: 45, preco: 70 });
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = http.put(`${BASE_URL}/servicos/1`, payload, { headers });
  check(res, { 'update 200 or 401 or 404': (r) => [200, 401, 404].includes(r.status) });
  sleep(1);
}

export function remove() {
  const token = getAuthToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = http.del(`${BASE_URL}/servicos/1`, null, { headers });
  check(res, { 'delete 204 or 401 or 404': (r) => [204, 401, 404].includes(r.status) });
  sleep(1);
}
