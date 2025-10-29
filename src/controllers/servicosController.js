const servicosService = require('../services/servicosService');

exports.listar = (req, res) => {
  const servicos = servicosService.listar();
  res.json(servicos);
};

exports.obter = (req, res) => {
  const servico = servicosService.obter(req.params.id);
  if (!servico) return res.status(404).json({ erro: 'Serviço não encontrado' });
  res.json(servico);
};

exports.criar = (req, res) => {
  try {
    const criado = servicosService.criar(req.body);
    res.status(201).json(criado);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
};

exports.atualizar = (req, res) => {
  try {
    const atualizado = servicosService.atualizar(req.params.id, req.body);
    if (!atualizado) return res.status(404).json({ erro: 'Serviço não encontrado' });
    res.json(atualizado);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
};

exports.remover = (req, res) => {
  const ok = servicosService.remover(req.params.id);
  if (!ok) return res.status(404).json({ erro: 'Serviço não encontrado' });
  res.status(204).send();
};
