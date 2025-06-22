// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Para permitir requisições de qualquer origem
const path = require('path'); // Para servir arquivos estáticos e ocultar extensões
const routes = require('./routes'); // Importa as rotas

const app = express();
const PORT = process.env.PORT || 3000;

// Conexão com o MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Conectado ao MongoDB Atlas com sucesso!'))
    .catch(err => console.error('Erro ao conectar ao MongoDB Atlas:', err));

// Middlewares
app.use(cors()); // Permite todas as origens
app.use(express.json()); // Para fazer o parse de requisições JSON
app.use(express.urlencoded({ extended: true })); // Para fazer o parse de requisições URL-encoded

// Configuração para servir arquivos estáticos e ocultar extensões .html
// O Express irá tentar servir o arquivo com a extensão .html se não encontrar sem.
app.use(express.static(path.join(__dirname), { extensions: ['html'] }));

// Rotas da API
app.use('/api', routes); // Todas as rotas da API estarão sob /api

// Rota catch-all para servir o index.html em caso de rota não encontrada (para SPAs, etc.)
// Isso é útil para o roteamento do frontend
app.get('*', (req, res) => {
    // Se a requisição não for para uma rota de API e não for um arquivo estático existente,
    // tente servir o index.html. Isso ajuda a mascarar as URLs sem a extensão.
    if (!req.path.startsWith('/api/') && !path.extname(req.path)) {
        res.sendFile(path.join(__dirname, 'index.html'));
    } else {
        // Se for um arquivo estático existente, o express.static já lidou com isso.
        // Se for uma rota de API que não existe, ou outro tipo de requisição,
        // retorna 404 ou deixa o Express lidar.
        res.status(404).send('Página não encontrada');
    }
});


// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});