// server.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const moment = require('moment-timezone'); // Para lidar com fuso horário de Maputo
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const cors = require('cors'); // Importar o pacote cors

dotenv.config(); // Carrega as variáveis de ambiente do .env

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do CORS para aceitar requisições de qualquer origem
app.use(cors());

// Middlewares
app.use(express.json()); // Para parsing de JSON no corpo das requisições
app.use(express.urlencoded({ extended: true })); // Para parsing de URL-encoded data

// Conexão com o MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Conectado ao MongoDB Atlas'))
    .catch(err => console.error('Erro ao conectar ao MongoDB Atlas:', err));

// Configuração do Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configuração do Multer para upload em memória (Cloudinary fará o upload final)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Configuração do Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Exportar módulos e configurações para uso em outros arquivos
module.exports = {
    app,
    mongoose,
    jwt,
    nodemailer,
    bcrypt,
    moment,
    upload,
    cloudinary,
    transporter
};

// Importar as rotas (será criado no próximo passo)
const routes = require('./routes'); // Importa o arquivo de rotas
app.use('/api', routes); // Prefixo para todas as rotas da API

// Rota de teste
app.get('/', (req, res) => {
    res.send('Servidor VEED online!');
});

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
