import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: __ENV.VUS ? parseInt(__ENV.VUS) : 10,
  duration: __ENV.DURATION || '30s',
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

function jsonHeaders(token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

function login(email, senha) {
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({ email, senha }), { headers: { 'Content-Type': 'application/json' } });
  return res;
}

export default function () {
  // 1) Login como cabeleireiro e registra um horário
  const resLoginC = login('carlos@salon.com', 'senha123');
  check(resLoginC, { 'login cabeleireiro ok': (r) => r.status === 200 && r.json() && r.json().token });
  if (resLoginC.status !== 200) {
    sleep(1);
    return;
  }
  const tokenC = resLoginC.json().token;

  const dataHora = new Date(Date.now() + Math.floor(Math.random() * 7 + 1) * 24 * 60 * 60 * 1000).toISOString();
  const resHorario = http.post(`${BASE_URL}/cabeleireiros/horarios`, JSON.stringify({ dataHora }), { headers: jsonHeaders(tokenC) });
  check(resHorario, { 'registrar horario 201': (r) => r.status === 201 });
  if (resHorario.status !== 201) {
    sleep(1);
    return;
  }
  const horario = resHorario.json();

  // 2) Login como cliente
  const resLoginCl = login('joana@cliente.com', 'senha123');
  check(resLoginCl, { 'login cliente ok': (r) => r.status === 200 && r.json() && r.json().token });
  if (resLoginCl.status !== 200) {
    sleep(1);
    return;
  }
  const tokenCl = resLoginCl.json().token;

  // 3) Buscar serviços
  const resServ = http.get(`${BASE_URL}/servicos`);
  check(resServ, { 'get servicos 200': (r) => r.status === 200 });
  const servicos = resServ.json();
  if (!servicos || servicos.length === 0) {
    sleep(1);
    return;
  }
  const servicoId = servicos[0].id;

  // 4) Cliente cria compromisso usando o horário previamente registrado
  const corpo = { cabeleireiroId: horario.cabeleireiroId, servicoId, dataHora: horario.dataHora };
  const resComp = http.post(`${BASE_URL}/compromissos`, JSON.stringify(corpo), { headers: jsonHeaders(tokenCl) });
  check(resComp, { 'criar compromisso 201': (r) => r.status === 201 });

  // Pausa leve entre iterações
  sleep(Math.random() * 2 + 0.5);
}
