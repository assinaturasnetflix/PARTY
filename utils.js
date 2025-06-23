// utils.js

const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');

dotenv.config();

// ----------------------------------------
// 1. CONFIGURAÇÃO DO CLOUDINARY (ABORDAGEM EXPLÍCITA)
// ----------------------------------------
// Esta é a mudança principal. Em vez de depender de uma URL,
// usamos as 3 variáveis de ambiente separadas para forçar a configuração.
// Isto é mais robusto e menos propenso a erros.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true // É boa prática forçar o uso de https
});

// Adicionamos este log para depuração.
// Ele irá aparecer nos logs do Render e mostrar-nos-á a configuração que está a ser usada.
// A api_secret deverá aparecer como '******' por segurança, mas a presença dela confirma a leitura.
console.log('[DEBUG] Configuração do Cloudinary utilizada:', cloudinary.config());


// O resto do arquivo permanece igual, usando o 'cloudinary' que foi configurado acima.
const imageStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'veed_images',
        allowed_formats: ['jpg', 'png', 'jpeg'],
        transformation: [{ width: 500, height: 500, crop: 'limit' }]
    }
});

const videoStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'veed_videos',
        resource_type: 'video',
        allowed_formats: ['mp4', 'mov', 'avi'],
    }
});

// Funções de token e email
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

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

module.exports = {
    generateToken,
    sendEmail,
    createWelcomeEmailHTML,
    createPasswordResetEmailHTML,
    imageStorage,
    videoStorage,
    cloudinary
};