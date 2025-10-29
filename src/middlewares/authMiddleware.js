const authService = require('../services/authService');

exports.autenticarJWT = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ erro: 'Token não fornecido' });
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ erro: 'Formato do token inválido' });
  const token = parts[1];
  try {
    const payload = authService.autenticarToken(token);
    req.user = payload; // { id, papel, nome }
    next();
  } catch (err) {
    res.status(401).json({ erro: 'Token inválido' });
  }
};

exports.requerPapel = (papel) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ erro: 'Não autenticado' });
  if (req.user.papel !== papel) return res.status(403).json({ erro: 'Acesso negado: papel insuficiente' });
  next();
};
