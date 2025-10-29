const express = require('express');
const router = express.Router();
const { autenticarJWT, requerPapel } = require('../middlewares/authMiddleware');
const cabeleireirosController = require('../controllers/cabeleireirosController');

// Cabeireiro registra horários disponiveis
router.post('/horarios', autenticarJWT, requerPapel('cabeleireiro'), cabeleireirosController.registrarHorario);
// Lista horários de um cabeleireiro (público)
router.get('/horarios/:cabeleireiroId', cabeleireirosController.listarHorariosPorCabeleireiro);

module.exports = router;
