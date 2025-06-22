// server.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const app = express();

// Carregar variáveis de ambiente do arquivo .env
dotenv.config();

// Importar as rotas
const routes = require('./routes');

// Conexão com o MongoDB Atlas
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Conectado ao MongoDB Atlas com sucesso!'))
  .catch(err => console.error('Erro ao conectar ao MongoDB Atlas:', err));

// Middlewares
app.use(express.json()); // Para fazer o parsing de requisições JSON
app.use(express.urlencoded({ extended: true })); // Para fazer o parsing de requisições com URL-encoded data
app.use(cors()); // Habilitar CORS para todas as origens

// Servir arquivos estáticos do frontend (isso será útil quando o frontend estiver pronto)
// Por enquanto, podemos deixar comentado ou apontar para uma pasta dummy se você quiser testar.
// Quando o frontend estiver pronto, a pasta 'public' ou 'dist' conterá seus arquivos HTML/CSS/JS.
// app.use(express.static(path.join(__dirname, 'public')));


// Rotas da API
app.use('/api', routes); // Todas as rotas definidas em routes.js serão prefixadas com /api

// Exemplo de rota inicial para testar o servidor
app.get('/', (req, res) => {
  res.send('Bem-vindo à API do VEED!');
});

// Tratamento de rotas não encontradas (404)
app.use((req, res, next) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});

// Middleware de tratamento de erros global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Algo deu errado no servidor!');
});


// Definir a porta do servidor
const PORT = process.env.PORT || 3000;

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor VEED rodando na porta ${PORT}`);
  console.log(`Para acessar a API, use: http://localhost:${PORT}/api`);
});