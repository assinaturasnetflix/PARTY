// utils.js
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const moment = require('moment-timezone');

// Função para gerar um token JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '7d', // Token expira em 7 dias
    });
};

// Configuração do Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Função para enviar e-mail de recuperação de senha
const sendPasswordResetEmail = async (email, token) => {
    const resetUrl = `http://localhost:${process.env.PORT || 3000}/reset-password?token=${token}`; // Use a URL real do seu frontend
    const mailOptions = {
        from: `VEED <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Recuperação de Senha - VEED',
        html: `
            <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #007bff; font-size: 28px;">VEED</h1>
                </div>
                <h2 style="color: #333333; text-align: center; margin-bottom: 25px;">Redefinição de Senha</h2>
                <p style="color: #555555; font-size: 16px; line-height: 1.6;">Olá,</p>
                <p style="color: #555555; font-size: 16px; line-height: 1.6;">Recebemos uma solicitação para redefinir a senha da sua conta VEED. Se você não fez essa solicitação, pode ignorar este e-mail com segurança.</p>
                <p style="color: #555555; font-size: 16px; line-height: 1.6;">Para redefinir sua senha, clique no botão abaixo:</p>
                <div style="text-align: center; margin-top: 30px;">
                    <a href="${resetUrl}" style="display: inline-block; padding: 15px 30px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 5px; font-size: 18px; font-weight: bold;">Redefinir Senha</a>
                </div>
                <p style="color: #555555; font-size: 14px; line-height: 1.6; text-align: center; margin-top: 30px;">Ou copie e cole o seguinte link no seu navegador:</p>
                <p style="color: #007bff; font-size: 14px; text-align: center; word-break: break-all;">${resetUrl}</p>
                <p style="color: #555555; font-size: 14px; line-height: 1.6; text-align: center; margin-top: 30px;">Este link de redefinição de senha expirará em 1 hora.</p>
                <p style="color: #555555; font-size: 16px; line-height: 1.6; margin-top: 40px;">Atenciosamente,</p>
                <p style="color: #555555; font-size: 16px; line-height: 1.6;">A equipe VEED</p>
                <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eeeeee; font-size: 12px; color: #aaaaaa;">
                    <p>&copy; ${new Date().getFullYear()} VEED. Todos os direitos reservados.</p>
                </div>
            </div>
        `,
    };
    await transporter.sendMail(mailOptions);
};

// Função para enviar e-mail de boas-vindas
const sendWelcomeEmail = async (email, username) => {
    const mailOptions = {
        from: `VEED <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Bem-vindo ao VEED!',
        html: `
            <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #007bff; font-size: 28px;">VEED</h1>
                </div>
                <h2 style="color: #333333; text-align: center; margin-bottom: 25px;">Bem-vindo à Plataforma VEED, ${username}!</h2>
                <p style="color: #555555; font-size: 16px; line-height: 1.6;">Estamos muito felizes em ter você conosco!</p>
                <p style="color: #555555; font-size: 16px; line-height: 1.6;">No VEED, você pode investir no seu futuro simplesmente assistindo a vídeos. Explore nossos planos, assista seus vídeos diários e comece a ganhar suas recompensas.</p>
                <p style="color: #555555; font-size: 16px; line-height: 1.6;">Se precisar de ajuda ou tiver alguma dúvida, sinta-se à vontade para visitar nossa seção de ajuda ou entrar em contato com o suporte.</p>
                <div style="text-align: center; margin-top: 30px;">
                    <a href="http://localhost:${process.env.PORT || 3000}/dashboard" style="display: inline-block; padding: 15px 30px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 5px; font-size: 18px; font-weight: bold;">Começar a Ganhar!</a>
                </div>
                <p style="color: #555555; font-size: 16px; line-height: 1.6; margin-top: 40px;">Atenciosamente,</p>
                <p style="color: #555555; font-size: 16px; line-height: 1.6;">A equipe VEED</p>
                <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eeeeee; font-size: 12px; color: #aaaaaa;">
                    <p>&copy; ${new Date().getFullYear()} VEED. Todos os direitos reservados.</p>
                </div>
            </div>
        `,
    };
    await transporter.sendMail(mailOptions);
};

// Função para obter a data atual em horário de Maputo (GMT+2)
const getMaputoDate = () => {
    return moment().tz("Africa/Maputo");
};

// Função para verificar se um email é válido
const isValidEmail = (email) => {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
};

// Exportar as funções auxiliares
module.exports = {
    generateToken,
    sendPasswordResetEmail,
    sendWelcomeEmail,
    getMaputoDate,
    isValidEmail,
};