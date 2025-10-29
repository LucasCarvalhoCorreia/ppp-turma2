const db = require('../models/db');
const { v4: uuidv4 } = require('uuid');

exports.registrarHorario = (usuario, { dataHora }) => {
  if (!dataHora) throw new Error('dataHora é obrigatório');
  const horario = { id: uuidv4(), cabeleireiroId: usuario.id, dataHora };
  db.horariosDisponiveis.push(horario);
  return horario;
};

exports.listarHorariosPorCabeleireiro = (cabeleireiroId) => db.horariosDisponiveis.filter(h => h.cabeleireiroId === cabeleireiroId);
