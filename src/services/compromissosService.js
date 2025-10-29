const db = require('../models/db');
const { v4: uuidv4 } = require('uuid');

exports.criar = (usuario, { cabeleireiroId, servicoId, dataHora }) => {
  if (!cabeleireiroId || !servicoId || !dataHora) throw new Error('cabeleireiroId, servicoId e dataHora são obrigatórios');

  // Verifica se horário está disponível
  const horarioIndex = db.horariosDisponiveis.findIndex(h => h.cabeleireiroId === cabeleireiroId && h.dataHora === dataHora);
  if (horarioIndex === -1) throw new Error('Horário não disponível');

  const servico = db.servicos.find(s => s.id === servicoId);
  if (!servico) throw new Error('Serviço inválido');

  const compromisso = {
    id: uuidv4(),
    clienteId: usuario.id,
    cabeleireiroId,
    servicoId,
    dataHora,
    status: 'agendado'
  };
  db.compromissos.push(compromisso);

  // remover o horário disponível usado
  db.horariosDisponiveis.splice(horarioIndex, 1);

  return compromisso;
};

exports.listar = (usuario, query) => {
  if (usuario.papel === 'cliente') {
    return db.compromissos.filter(c => c.clienteId === usuario.id);
  }
  if (usuario.papel === 'cabeleireiro') {
    return db.compromissos.filter(c => c.cabeleireiroId === usuario.id);
  }
  return [];
};
