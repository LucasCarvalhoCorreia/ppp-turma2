// Testes de performance dos endpoints de `cabeleireiros/horarios`
// Endpoints testados por este script:
// - POST /cabeleireiros/horarios
// - GET  /cabeleireiros/horarios/{cabeleireiroId}
//
// Variáveis de ambiente usadas (opcionais):
// BASE_URL, CAB_EMAIL, CAB_SENHA, VUS_CREATE, VUS_LIST, DURATION
import http from 'k6/http';
import { check, sleep } from 'k6';
import encoding from 'k6/encoding';

export const options = {
  scenarios: {
    criar: {
      executor: 'constant-vus',
      exec: 'criar',
      vus: __ENV.VUS_CREATE ? parseInt(__ENV.VUS_CREATE) : 3,
      duration: __ENV.DURATION || '20s',
    },
    listar: {
      executor: 'constant-vus',
      exec: 'listar',
      vus: __ENV.VUS_LIST ? parseInt(__ENV.VUS_LIST) : 5,
      duration: __ENV.DURATION || '20s',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
// usa usuário seed por padrão para garantir caminho feliz
const CABELEIREIRO_EMAIL = __ENV.CAB_EMAIL || 'carlos@salon.com';
const CABELEIREIRO_SENHA = __ENV.CAB_SENHA || 'senha123';

function getToken() {
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({ email: CABELEIREIRO_EMAIL, senha: CABELEIREIRO_SENHA }), { headers: { 'Content-Type': 'application/json' } });
  if (res.status === 200) {
    try { return JSON.parse(res.body).token; } catch (e) { return null; }
  }
  return null;
}

export function criar() {
  // Método: POST /cabeleireiros/horarios
  const token = getToken();
  const payload = JSON.stringify({
    // o serviço usa o id do usuário do token; não precisa enviar cabeleireiroId
    dataHora: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  });
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = http.post(`${BASE_URL}/cabeleireiros/horarios`, payload, { headers });
  // cenário feliz: deve retornar apenas 201
  check(res, { 'horarios criar 201': (r) => r.status === 201 });
  sleep(1);
}

export function listar() {
  // Método: GET /cabeleireiros/horarios/{cabeleireiroId}
  // obter token e extrair id do cabeleireiro a partir do JWT
  const token = getToken();
  let cabeleireiroId = 'unknown';
  if (token) {
    try {
      const payload = token.split('.')[1];
      const json = JSON.parse(encoding.b64decode(payload, 'url', 's'));
      cabeleireiroId = json.id || cabeleireiroId;
    } catch (e) { /* noop */ }
  }
  const res = http.get(`${BASE_URL}/cabeleireiros/horarios/${cabeleireiroId}`);
  // cenário feliz: deve retornar apenas 200
  check(res, { 'horarios listar 200': (r) => r.status === 200 });
  sleep(1);
}
