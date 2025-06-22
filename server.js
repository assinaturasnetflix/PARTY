// server.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors'); // Para permitir requisições de qualquer origem
const path = require('path'); // Para servir arquivos estáticos no futuro
const app = express();

// Carregar variáveis de ambiente do arquivo .env
dotenv.config();

// Conexão com o MongoDB Atlas
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Conectado ao MongoDB Atlas com sucesso!'))
  .catch(err => console.error('Erro ao conectar ao MongoDB Atlas:', err));

// Middlewares
app.use(express.json()); // Para fazer o parsing de requisições JSON
app.use(express.urlencoded({ extended: true })); // Para fazer o parsing de requisições com URL-encoded data
app.use(cors()); // Habilitar CORS para todas as origens

// Definir a porta do servidor
const PORT = process.env.PORT || 3000;

// Exemplo de rota inicial para testar o servidor
app.get('/', (req, res) => {
  res.send('Bem-vindo à API do VEED!');
});

// AQUI IREMOS IMPORTAR E USAR AS ROTAS DEFINIDAS EM 'routes.js' MAIS TARDE
// const routes = require('./routes');
// app.use('/api', routes);

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor VEED rodando na porta ${PORT}`);
});