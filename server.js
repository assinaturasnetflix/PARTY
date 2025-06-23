// server.js

// -----------------------------------------------
// 1. IMPORTAÇÃO DE MÓDULOS E CONFIGURAÇÃO INICIAL
// -----------------------------------------------
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

// Inicializa a aplicação Express
const app = express();

// -----------------------------------------------
// 2. CONFIGURAÇÃO DE MIDDLEWARES
// -----------------------------------------------

// Configuração do CORS para aceitar requisições de qualquer origem.
app.use(cors());

// Middleware para analisar o corpo das requisições como JSON
app.use(express.json());

// Middleware para analisar corpos de requisição urlencoded (formulários HTML)
app.use(express.urlencoded({ extended: true }));

// Middleware para servir arquivos estáticos (se necessário no futuro)
app.use('/public', express.static(path.join(__dirname, 'public')));


// -----------------------------------------------
// 3. CONEXÃO COM O BANCO DE DADOS MONGODB ATLAS
// -----------------------------------------------
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error("ERRO: A variável de ambiente MONGODB_URI não está definida.");
    process.exit(1); // Encerra o processo se a URI do banco de dados não for encontrada
}

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log("Conexão com o MongoDB Atlas estabelecida com sucesso.");
    })
    .catch((err) => {
        console.error("Erro ao conectar ao MongoDB Atlas:");
        console.error(err);
        process.exit(1); // Encerra o processo em caso de falha na conexão
    });

// -----------------------------------------------
// 4. IMPORTAÇÃO E USO DAS ROTAS DA APLICAÇÃO
// -----------------------------------------------

// Todas as rotas da aplicação serão importadas do arquivo 'routes.js'
const appRoutes = require('./routes');
app.use('/api', appRoutes); // Prefixo '/api' para todas as rotas da aplicação


// -----------------------------------------------
// 5. TRATAMENTO DE ERROS
// -----------------------------------------------

// Importa o nosso tratador de erros centralizado do arquivo de controllers
const { errorHandler } = require('./controllers');

// Middleware para rotas não encontradas (deve vir antes do errorHandler)
// Captura qualquer requisição que não correspondeu a uma rota anterior
app.use((req, res, next) => {
    const error = new Error(`Endpoint não encontrado - ${req.originalUrl}`);
    res.status(404);
    next(error); // Passa o erro para o próximo middleware (o errorHandler)
});

// Middleware para tratamento de erros. Ele recebe o 'error' do 'next(error)'.
// Deve ser o último middleware a ser adicionado na pilha.
app.use(errorHandler);


// -----------------------------------------------
// 6. INICIALIZAÇÃO DO SERVIDOR
// -----------------------------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor VEED está a ser executado na porta ${PORT}`);
});

// Tratamento de erros não capturados para evitar que o servidor quebre
process.on('uncaughtException', (error) => {
    console.error('Exceção não capturada:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Rejeição de Promise não tratada:', reason);
    process.exit(1);
});