// Testes de performance dos endpoints de `compromissos`
// Endpoints testados por este script:
// - POST /compromissos
// - GET  /compromissos
//
// Variáveis de ambiente usadas (opcionais):
// BASE_URL, CLIENT_EMAIL, CLIENT_SENHA, VUS_CREATE, VUS_LIST, DURATION
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    criar: {
      executor: 'constant-vus',
      exec: 'criar',
      vus: __ENV.VUS_CREATE ? parseInt(__ENV.VUS_CREATE) : 5,
      duration: __ENV.DURATION || '20s',
    },
    listar: {
      executor: 'constant-vus',
      exec: 'listar',
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

export function criar() {
  // Fluxo "happy path" completo:
  // 1) Cabeleireiro novo -> login -> registra horário
  // 2) Cliente novo -> login
  // 3) Busca um serviço válido
  // 4) Cliente agenda com { cabeleireiroId, servicoId, dataHora }

  const headersJson = { headers: { 'Content-Type': 'application/json' } };

  const rnd = Math.floor(Math.random() * 1e9);
  const cabEmail = `k6-cab-${rnd}@ex.com`;
  const cliEmail = `k6-cli-${rnd}@ex.com`;
  const senha = 'senha123';
  const dataHora = new Date(Date.now() + 3600 * 1000).toISOString(); // +1h

  // 1) Cabeleireiro: cadastrar e logar
  const cabCad = http.post(
    `${BASE_URL}/auth/cadastrar`,
    JSON.stringify({ nome: 'K6 Cab', email: cabEmail, senha, papel: 'cabeleireiro' }),
    headersJson
  );
  const cabId = cabCad.status === 201 ? cabCad.json('id') : null;

  const cabLogin = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: cabEmail, senha }),
    headersJson
  );
  const tokenCab = cabLogin.status === 200 ? cabLogin.json('token') : null;

  // Registrar horário com token do cabeleireiro
  const regHorario = http.post(
    `${BASE_URL}/cabeleireiros/horarios`,
    JSON.stringify({ dataHora }),
    { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCab}` } }
  );

  // 2) Cliente: cadastrar e logar
  const cliCad = http.post(
    `${BASE_URL}/auth/cadastrar`,
    JSON.stringify({ nome: 'K6 Cli', email: cliEmail, senha, papel: 'cliente' }),
    headersJson
  );
  const cliLogin = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: cliEmail, senha }),
    headersJson
  );
  const tokenCli = cliLogin.status === 200 ? cliLogin.json('token') : null;

  // 3) Descobrir um serviço válido
  const servList = http.get(`${BASE_URL}/servicos`);
  let servicoId = null;
  if (servList.status === 200) {
    try { servicoId = servList.json()[0]?.id || null; } catch (e) { servicoId = null; }
  }

  // 4) Cliente agenda compromisso
  const res = http.post(
    `${BASE_URL}/compromissos`,
    JSON.stringify({ cabeleireiroId: cabId, servicoId, dataHora }),
    { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCli}` } }
  );

  // cenário feliz: deve retornar apenas 201
  check(res, { 'compromissos criar 201': (r) => r.status === 201 });
  sleep(1);
}

export function listar() {
  // Método: GET /compromissos
  const token = getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = http.get(`${BASE_URL}/compromissos`, { headers });
  // cenário feliz: deve retornar apenas 200
  check(res, { 'compromissos listar 200': (r) => r.status === 200 });
  sleep(1);
}
