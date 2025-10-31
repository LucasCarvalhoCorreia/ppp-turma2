// Banco de dados em memória
const { v4: uuidv4 } = require('uuid');

const db = {
  usuarios: [], // { id, nome, email, senha, papel }
  servicos: [], // { id, nome, duracao, preco, categoria, descricao }
  compromissos: [], // { id, clienteId, cabeleireiroId, servicoId, dataHora, status }
  horariosDisponiveis: [] // { id, cabeleireiroId, dataHora }
};

// inicializadores simples para facilitar testes
(function seed() {
  // Usuários exemplo
  db.usuarios.push({ id: uuidv4(), nome: 'Joana Cliente', email: 'joana@cliente.com', senha: 'senha123', papel: 'cliente' });
  db.usuarios.push({ id: uuidv4(), nome: 'Carlos Cabeleireiro', email: 'carlos@salon.com', senha: 'senha123', papel: 'cabeleireiro' });

  // Serviço exemplo
  db.servicos.push({ id: uuidv4(), nome: 'Corte Feminino', duracao: 45, preco: 80.0, categoria: 'cabelo', descricao: 'Corte e finalização' });
})();

// Função para reinicializar o DB (útil para testes)
db.reset = function () {
  db.usuarios.length = 0;
  db.servicos.length = 0;
  db.compromissos.length = 0;
  db.horariosDisponiveis.length = 0;
  // re-seed
  db.usuarios.push({ id: uuidv4(), nome: 'Joana Cliente', email: 'joana@cliente.com', senha: 'senha123', papel: 'cliente' });
  db.usuarios.push({ id: uuidv4(), nome: 'Carlos Cabeleireiro', email: 'carlos@salon.com', senha: 'senha123', papel: 'cabeleireiro' });
  db.servicos.push({ id: uuidv4(), nome: 'Corte Feminino', duracao: 45, preco: 80.0, categoria: 'cabelo', descricao: 'Corte e finalização' });
};

module.exports = db;
