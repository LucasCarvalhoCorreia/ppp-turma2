const cabeleireirosService = require('../services/cabeleireirosService');

exports.registrarHorario = (req, res) => {
  try {
    const horario = cabeleireirosService.registrarHorario(req.user, req.body);
    res.status(201).json(horario);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
};

exports.listarHorariosPorCabeleireiro = (req, res) => {
  try {
    const lista = cabeleireirosService.listarHorariosPorCabeleireiro(req.params.cabeleireiroId);
    res.json(lista);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
};
