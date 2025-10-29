const db = require('../models/db');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'troque_esta_chave_em_producao';

exports.cadastrar = ({ nome, email, senha, papel }) => {
  if (!nome || !email || !senha || !papel) throw new Error('nome, email, senha e papel são obrigatórios');
  if (!['cliente', 'cabeleireiro'].includes(papel)) throw new Error('papel inválido');
  const exists = db.usuarios.find(u => u.email === email);
  if (exists) throw new Error('Email já cadastrado');
  const usuario = { id: uuidv4(), nome, email, senha, papel };
  db.usuarios.push(usuario);
  // Não retornar a senha
  const { senha: _, ...ret } = usuario;
  return ret;
};

exports.login = ({ email, senha }) => {
  if (!email || !senha) throw new Error('email e senha são obrigatórios');
  const usuario = db.usuarios.find(u => u.email === email && u.senha === senha);
  if (!usuario) throw new Error('Credenciais inválidas');
  const token = jwt.sign({ id: usuario.id, papel: usuario.papel, nome: usuario.nome }, JWT_SECRET, { expiresIn: '8h' });
  return token;
};

exports.autenticarToken = (token) => {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload;
  } catch (err) {
    throw new Error('Token inválido');
  }
};
