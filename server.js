// server.js

// -----------------------------------------------
// 1. IMPORTAÇÃO DE MÓDULOS E CONFIGURAÇÃO INICIAL
// -----------------------------------------------
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();
const app = express();

// -----------------------------------------------
// 2. CONFIGURAÇÃO DE MIDDLEWARES
// -----------------------------------------------

// Configuração explícita e robusta do CORS
const corsOptions = {
  origin: '*', // Permite que qualquer frontend aceda à sua API.
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // Permite todos os métodos HTTP necessários.
  allowedHeaders: ['Content-Type', 'Authorization'], // Permite os cabeçalhos que estamos a usar.
};

// Habilita o pre-flight request para todas as rotas. Essencial para POST, PUT, etc.
app.options('*', cors(corsOptions));

// Usa a configuração CORS para todas as outras requisições.
app.use(cors(corsOptions));


// Middleware para analisar o corpo das requisições como JSON
app.use(express.json());

// Middleware para analisar corpos de requisição urlencoded (formulários HTML)
app.use(express.urlencoded({ extended: true }));

// Middleware para servir arquivos estáticos
app.use('/public', express.static(path.join(__dirname, 'public')));


// -----------------------------------------------
// 3. CONEXÃO COM O BANCO DE DADOS MONGODB ATLAS
// -----------------------------------------------
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error("ERRO: A variável de ambiente MONGODB_URI não está definida.");
    process.exit(1);
}

mongoose.connect(MONGODB_URI)
    .then(() => console.log("Conexão com o MongoDB Atlas estabelecida com sucesso."))
    .catch((err) => {
        console.error("Erro ao conectar ao MongoDB Atlas:", err);
        process.exit(1);
    });

// -----------------------------------------------
// 4. IMPORTAÇÃO E USO DAS ROTAS DA APLICAÇÃO
// -----------------------------------------------
const appRoutes = require('./routes');
app.use('/api', appRoutes);

// -----------------------------------------------
// 5. TRATAMENTO DE ERROS
// -----------------------------------------------
const { errorHandler } = require('./controllers');

app.use((req, res, next) => {
    const error = new Error(`Endpoint não encontrado - ${req.originalUrl}`);
    res.status(404);
    next(error);
});

app.use(errorHandler);

// -----------------------------------------------
// 6. INICIALIZAÇÃO DO SERVIDOR
// -----------------------------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor VEED está a ser executado na porta ${PORT}`);
});

process.on('uncaughtException', (error) => {
    console.error('Exceção não capturada:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Rejeição de Promise não tratada:', reason);
    process.exit(1);
});