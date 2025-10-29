const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const YAML = require('yamljs');
const swaggerUi = require('swagger-ui-express');

const authRoutes = require('./routes/authRoutes');
const servicosRoutes = require('./routes/servicosRoutes');
const compromissosRoutes = require('./routes/compromissosRoutes');
const cabeleireirosRoutes = require('./routes/cabeleireirosRoutes');

const swaggerDocument = YAML.load('./resources/swagger.yaml');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use('/auth', authRoutes);
app.use('/servicos', servicosRoutes);
app.use('/compromissos', compromissosRoutes);
app.use('/cabeleireiros', cabeleireirosRoutes);

// Rota para visualizar a documentação Swagger
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// rota raiz
app.get('/', (req, res) => {
  res.json({ mensagem: 'API do Salão de Beleza — bem vindo(a)! Visite /docs para a documentação Swagger.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}. Acesse http://localhost:${PORT}/docs`);
});
