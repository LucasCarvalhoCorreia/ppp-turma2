const compromissosService = require('../services/compromissosService');

exports.criar = (req, res) => {
  try {
    const agendamento = compromissosService.criar(req.user, req.body);
    res.status(201).json(agendamento);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
};

exports.listar = (req, res) => {
  try {
    const lista = compromissosService.listar(req.user, req.query);
    res.json(lista);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
};
