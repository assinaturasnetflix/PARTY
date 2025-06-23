// utils.js

const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');

dotenv.config();

// ----------------------------------------
// 1. CONFIGURAÇÃO DO CLOUDINARY (VIA ENV)
// ----------------------------------------
// Não configuramos mais o Cloudinary com chaves "hardcoded".
// O SDK do Cloudinary é inteligente e irá configurar-se automaticamente
// se encontrar a variável de ambiente CLOUDINARY_URL, que configurámos no Render.
if (!process.env.CLOUDINARY_URL) {
    console.error("ERRO FATAL: A variável de ambiente CLOUDINARY_URL não está definida.");
    // Num ambiente de produção, isto poderia parar a aplicação para evitar erros inesperados.
    // process.exit(1); 
}

// Configuração de armazenamento para IMAGENS (avatares, comprovantes)
// Esta configuração agora usa o objeto 'cloudinary' que foi autoconfigurado acima.
const imageStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'veed_images', // Pasta no Cloudinary para organizar as imagens
        allowed_formats: ['jpg', 'png', 'jpeg'],
        transformation: [{ width: 500, height: 500, crop: 'limit' }] // Redimensiona para um tamanho razoável
    }
});

// Configuração de armazenamento para VÍDEOS
const videoStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'veed_videos', // Pasta no Cloudinary para organizar os vídeos
        resource_type: 'video',
        allowed_formats: ['mp4', 'mov', 'avi'],
    }
});


// ----------------------------------------
// 2. GERAÇÃO DE TOKEN JWT
// ----------------------------------------
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d' // O token expira em 30 dias
    });
};

// ----------------------------------------
// 3. CONFIGURAÇÃO E ENVIO DE E-MAILS (NODEMAILER)
// ----------------------------------------

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

const sendEmail = async (mailOptions) => {
    try {
        await transporter.sendMail(mailOptions);
        console.log('E-mail enviado com sucesso para:', mailOptions.to);
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error);
    }
};

const createWelcomeEmailHTML = (username) => {
    return `
        <div style="font-family: 'Poppins', Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
            <div style="background-color: #004AAD; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 28px;">Bem-vindo à VEED!</h1>
            </div>
            <div style="padding: 30px;">
                <h2 style="color: #E63946;">Olá, ${username}!</h2>
                <p>Estamos muito felizes por ter você connosco. A sua jornada para ganhar recompensas assistindo a vídeos começa agora!</p>
                <p>Como presente de boas-vindas, creditamos <strong>50,00 MT</strong> na sua carteira. Para começar, explore os nossos planos, escolha o que melhor se adapta a si e comece a assistir!</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL || '#'}/login.html" style="background-color: #E63946; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Acessar a minha conta</a>
                </div>
                <p>Se tiver alguma dúvida, visite a nossa <a href="${process.env.FRONTEND_URL || '#'}/help.html" style="color: #004AAD;">Página de Ajuda</a>.</p>
                <p>Atenciosamente,<br><strong>Equipa VEED</strong></p>
            </div>
            <div style="background-color: #f4f4f4; color: #888; padding: 15px; text-align: center; font-size: 12px;">
                <p>&copy; ${new Date().getFullYear()} VEED. Todos os direitos reservados.</p>
            </div>
        </div>
    `;
};

const createPasswordResetEmailHTML = (resetURL) => {
    return `
        <div style="font-family: 'Poppins', Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
            <div style="background-color: #004AAD; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 28px;">Redefinição de Senha</h1>
            </div>
            <div style="padding: 30px;">
                <h2 style="color: #E63946;">Esqueceu a sua senha?</h2>
                <p>Recebemos um pedido para redefinir a senha da sua conta na VEED. Se não foi você, por favor, ignore este e-mail.</p>
                <p>Para criar uma nova senha, clique no botão abaixo. Este link é válido por 10 minutos.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetURL}" style="background-color: #E63946; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Redefinir Senha</a>
                </div>
                <p>Se o botão não funcionar, copie e cole o seguinte link no seu navegador:</p>
                <p style="word-break: break-all; color: #004AAD;">${resetURL}</p>
                <p>Atenciosamente,<br><strong>Equipa VEED</strong></p>
            </div>
            <div style="background-color: #f4f4f4; color: #888; padding: 15px; text-align: center; font-size: 12px;">
                <p>&copy; ${new Date().getFullYear()} VEED. Todos os direitos reservados.</p>
            </div>
        </div>
    `;
};


// ----------------------------------------
// EXPORTAÇÃO DOS MÓDULOS
// ----------------------------------------
module.exports = {
    generateToken,
    sendEmail,
    createWelcomeEmailHTML,
    createPasswordResetEmailHTML,
    imageStorage,
    videoStorage,
    cloudinary
};