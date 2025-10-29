const db = require('../models/db');
const { v4: uuidv4 } = require('uuid');

exports.listar = () => db.servicos;

exports.obter = (id) => db.servicos.find(s => s.id === id);

exports.criar = ({ nome, duracao, preco, categoria, descricao }) => {
  if (!nome || !duracao || !preco || !categoria) throw new Error('nome, duracao, preco e categoria são obrigatórios');
  const servico = { id: uuidv4(), nome, duracao, preco: Number(preco), categoria, descricao: descricao || '' };
  db.servicos.push(servico);
  return servico;
};

exports.atualizar = (id, dados) => {
  const serv = db.servicos.find(s => s.id === id);
  if (!serv) return null;
  serv.nome = dados.nome ?? serv.nome;
  serv.duracao = dados.duracao ?? serv.duracao;
  serv.preco = dados.preco ?? serv.preco;
  serv.categoria = dados.categoria ?? serv.categoria;
  serv.descricao = dados.descricao ?? serv.descricao;
  return serv;
};

exports.remover = (id) => {
  const idx = db.servicos.findIndex(s => s.id === id);
  if (idx === -1) return false;
  db.servicos.splice(idx, 1);
  return true;
};
