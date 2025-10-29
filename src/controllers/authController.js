const authService = require('../services/authService');

exports.cadastrar = (req, res) => {
  try {
    const usuario = authService.cadastrar(req.body);
    res.status(201).json(usuario);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
};

exports.login = (req, res) => {
  try {
    const token = authService.login(req.body);
    res.json({ token });
  } catch (err) {
    res.status(401).json({ erro: err.message });
  }
};
