// server.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer'); // Mantenha esta linha
const bcrypt = require('bcryptjs');
const moment = require('moment-timezone');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Conectado ao MongoDB Atlas'))
    .catch(err => console.error('Erro ao conectar ao MongoDB Atlas:', err));

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Mantenha esta configuração do transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// MODIFICAÇÃO AQUI: Exporte 'transporter' diretamente, e não o módulo 'nodemailer' inteiro.
// Mantenha as outras exportações conforme estavam.
module.exports = {
    app,
    mongoose,
    jwt,
    // Antes: nodemailer,
    transporter, // AGORA: Exporte a instância do transporter
    bcrypt,
    moment,
    upload,
    cloudinary
};

const routes = require('./routes');
app.use('/api', routes);

app.get('/', (req, res) => {
    res.send('Servidor VEED online!');
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});