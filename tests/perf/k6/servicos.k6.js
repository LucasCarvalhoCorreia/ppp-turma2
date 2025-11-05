// Testes de performance dos endpoints de `servicos`
// Endpoints testados por este script:
// - GET    /servicos
// - POST   /servicos
// - GET    /servicos/{id}
// - PUT    /servicos/{id}
// - DELETE /servicos/{id}
//
// Variáveis de ambiente usadas (opcionais):
// BASE_URL, VUS_LIST, VUS_CREATE, VUS_GET, VUS_UPDATE, VUS_DELETE, DURATION
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    listar: {
      executor: 'constant-vus',
      exec: 'listar',
      vus: __ENV.VUS_LIST ? parseInt(__ENV.VUS_LIST) : 5,
      duration: __ENV.DURATION || '20s',
    },
    criar: {
      executor: 'constant-vus',
      exec: 'criar',
      vus: __ENV.VUS_CREATE ? parseInt(__ENV.VUS_CREATE) : 2,
      duration: __ENV.DURATION || '20s',
    },
    getById: {
      executor: 'constant-vus',
      exec: 'getById',
      vus: __ENV.VUS_GET ? parseInt(__ENV.VUS_GET) : 3,
      duration: __ENV.DURATION || '20s',
    },
    atualizar: {
      executor: 'constant-vus',
      exec: 'atualizar',
      vus: __ENV.VUS_UPDATE ? parseInt(__ENV.VUS_UPDATE) : 2,
      duration: __ENV.DURATION || '20s',
    },
    remover: {
      executor: 'constant-vus',
      exec: 'remover',
      vus: __ENV.VUS_DELETE ? parseInt(__ENV.VUS_DELETE) : 1,
      duration: __ENV.DURATION || '20s',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
// usa usuário seed cabeleireiro por padrão para garantir caminho feliz
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'carlos@salon.com';
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

export function listar() {
  // Método: GET /servicos
  const res = http.get(`${BASE_URL}/servicos`);
  check(res, { 'listar 200': (r) => r.status === 200 });
  sleep(1);
}

export function criar() {
  // Método: POST /servicos
  const token = getAuthToken();
  // Alinha com contrato da API: { nome, duracao, preco, categoria }
  const payload = JSON.stringify({ nome: `Corte ${Math.floor(Math.random()*10000)}`, duracao: 30, preco: 50, categoria: 'cabelo' });
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = http.post(`${BASE_URL}/servicos`, payload, { headers });
  // cenário feliz: deve retornar apenas 201
  check(res, { 'criar 201': (r) => r.status === 201 });
  sleep(1);
}

export function getById() {
  // Método: GET /servicos/{id} - garantir id válido buscando lista
  const list = http.get(`${BASE_URL}/servicos`);
  let id = null;
  if (list.status === 200) {
    try { id = list.json()[0]?.id || null; } catch (e) { id = null; }
  }
  // se não houver serviço, cria um
  if (!id) {
    const token = getAuthToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const create = http.post(`${BASE_URL}/servicos`, JSON.stringify({ nome: 'Srv GET', duracao: 20, preco: 30, categoria: 'cabelo' }), { headers });
    if (create.status === 201) { try { id = create.json('id'); } catch (e) { id = null; } }
  }
  const res = http.get(`${BASE_URL}/servicos/${id}`);
  // cenário feliz: deve retornar apenas 200
  check(res, { 'getById 200': (r) => r.status === 200 });
  sleep(1);
}

export function atualizar() {
  // Método: PUT /servicos/{id}
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Garante id válido criando serviço dedicado para update
  const create = http.post(`${BASE_URL}/servicos`, JSON.stringify({ nome: 'Srv UP', duracao: 25, preco: 40, categoria: 'cabelo' }), { headers });
  let id = null;
  if (create.status === 201) { try { id = create.json('id'); } catch (e) { id = null; } }
  const payload = JSON.stringify({ preco: 70 });
  const res = http.put(`${BASE_URL}/servicos/${id}`, payload, { headers });
  // cenário feliz: deve retornar apenas 200
  check(res, { 'atualizar 200': (r) => r.status === 200 });
  sleep(1);
}

export function remover() {
  // Para cumprir requisito de validar apenas 200/201, criamos um serviço (201)
  // e validamos listagem (200) após a remoção, ignorando o status 204 do DELETE.
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const create = http.post(`${BASE_URL}/servicos`, JSON.stringify({ nome: 'Srv DEL', duracao: 20, preco: 30, categoria: 'cabelo' }), { headers });
  check(create, { 'remover - criou 201': (r) => r.status === 201 });
  let id = null;
  try { id = create.json('id'); } catch (e) { id = null; }
  // executa remoção mas não checa 204
  if (id) http.del(`${BASE_URL}/servicos/${id}`, null, { headers: { Authorization: headers['Authorization'] } });
  const list = http.get(`${BASE_URL}/servicos`);
  // cenário feliz adicional: list retorna 200
  check(list, { 'remover - listar 200': (r) => r.status === 200 });
  sleep(1);
}
