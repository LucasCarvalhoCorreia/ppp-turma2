const express = require('express');
const router = express.Router();
const compromissosController = require('../controllers/compromissosController');
const { autenticarJWT, requerPapel } = require('../middlewares/authMiddleware');

// POST /compromissos (cliente cria agendamento)
router.post('/', autenticarJWT, requerPapel('cliente'), compromissosController.criar);
// GET /compromissos (lista para cliente ou cabeleireiro)
router.get('/', autenticarJWT, compromissosController.listar);

module.exports = router;
