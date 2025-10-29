const express = require('express');
const router = express.Router();
const servicosController = require('../controllers/servicosController');
const { autenticarJWT, requerPapel } = require('../middlewares/authMiddleware');

// GET /servicos
router.get('/', servicosController.listar);
// GET /servicos/:id
router.get('/:id', servicosController.obter);
// POST /servicos (cabeleireiro)
router.post('/', autenticarJWT, requerPapel('cabeleireiro'), servicosController.criar);
// PUT /servicos/:id
router.put('/:id', autenticarJWT, requerPapel('cabeleireiro'), servicosController.atualizar);
// DELETE /servicos/:id
router.delete('/:id', autenticarJWT, requerPapel('cabeleireiro'), servicosController.remover);

module.exports = router;
