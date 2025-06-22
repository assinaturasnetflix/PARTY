// utils.js
const { jwt, nodemailer } = require('./server'); // Importa jwt e nodemailer do server.js
const { User } = require('./models'); // Importa o modelo User
const moment = require('moment-timezone'); // Importa moment-timezone

// Função para gerar token JWT
function generateToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' }); // Token expira em 1 hora
}

// Função para enviar email de recuperação de senha
async function sendPasswordResetEmail(email, token) {
    const resetUrl = `http://localhost:3000/reset-password.html?token=${token}`; // A URL real será a do frontend
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'VEED - Recuperação de Senha',
        html: `
            <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
                <div style="background-color: #007bff; padding: 20px; text-align: center; color: white;">
                    <h1 style="margin: 0;">VEED</h1>
                    <p style="font-size: 14px;">Seu portal de investimento através de vídeos</p>
                </div>
                <div style="padding: 30px; text-align: center; color: #333;">
                    <h2 style="color: #007bff;">Redefinição de Senha</h2>
                    <p>Olá,</p>
                    <p>Recebemos uma solicitação para redefinir a sua senha na plataforma VEED.</p>
                    <p>Para redefinir sua senha, por favor, clique no botão abaixo:</p>
                    <a href="${resetUrl}" style="display: inline-block; background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 20px;">Redefinir Senha</a>
                    <p style="margin-top: 30px;">Se você não solicitou a redefinição de senha, por favor, ignore este e-mail.</p>
                    <p style="font-size: 12px; color: #666; margin-top: 40px;">Este é um e-mail automático, por favor, não responda.</p>
                </div>
                <div style="background-color: #f8f9fa; padding: 15px; text-align: center; color: #777; font-size: 12px; border-top: 1px solid #eee;">
                    <p>&copy; ${new Date().getFullYear()} VEED. Todos os direitos reservados.</p>
                </div>
            </div>
        `
    };

    try {
        await nodemailer.transporter.sendMail(mailOptions);
        console.log('Email de recuperação de senha enviado para:', email);
        return true;
    } catch (error) {
        console.error('Erro ao enviar email de recuperação de senha:', error);
        return false;
    }
}

// Função para enviar email de boas-vindas
async function sendWelcomeEmail(email, username) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Bem-vindo(a) à VEED!',
        html: `
            <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
                <div style="background-color: #dc3545; padding: 20px; text-align: center; color: white;">
                    <h1 style="margin: 0;">VEED</h1>
                    <p style="font-size: 14px;">Seu portal de investimento através de vídeos</p>
                </div>
                <div style="padding: 30px; text-align: center; color: #333;">
                    <h2 style="color: #dc3545;">Boas-Vindas, ${username}!</h2>
                    <p>Olá,</p>
                    <p>É com grande alegria que damos as boas-vindas à plataforma VEED!</p>
                    <p>Prepare-se para investir e ganhar enquanto assiste a vídeos.</p>
                    <p>Seu bônus de 50 MT já foi creditado em sua carteira. Lembre-se, este bônus pode ser sacado assim que você tiver um plano ativo.</p>
                    <p style="margin-top: 20px;">Comece agora mesmo a explorar os planos e a assistir seus primeiros vídeos!</p>
                    <a href="http://localhost:3000/login.html" style="display: inline-block; background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 20px;">Acessar a Plataforma</a>
                    <p style="font-size: 12px; color: #666; margin-top: 40px;">Este é um e-mail automático, por favor, não responda.</p>
                </div>
                <div style="background-color: #f8f9fa; padding: 15px; text-align: center; color: #777; font-size: 12px; border-top: 1px solid #eee;">
                    <p>&copy; ${new Date().getFullYear()} VEED. Todos os direitos reservados.</p>
                </div>
            </div>
        `
    };

    try {
        await nodemailer.transporter.sendMail(mailOptions);
        console.log('Email de boas-vindas enviado para:', email);
        return true;
    } catch (error) {
        console.error('Erro ao enviar email de boas-vindas:', error);
        return false;
    }
}

// Middleware para verificar token JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ message: 'Acesso negado. Token não fornecido.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token inválido ou expirado.' });
        }
        req.userId = user.userId;
        next();
    });
}

// Middleware para verificar se o usuário é admin
async function authorizeAdmin(req, res, next) {
    try {
        const user = await User.findById(req.userId);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ message: 'Acesso negado. Requer privilégios de administrador.' });
        }
        next();
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor ao verificar admin.', error: error.message });
    }
}

// Função para verificar se a data atual é diferente da última data de recompensa diária (para o fuso horário de Maputo)
function isNewDayForReward(lastRewardDate) {
    if (!lastRewardDate) return true; // Se nunca recebeu recompensa, é um novo dia

    const lastRewardMoment = moment.tz(lastRewardDate, 'Africa/Maputo');
    const currentMoment = moment.tz('Africa/Maputo');

    // Verifica se a data atual (ano, mês, dia) é diferente da última data de recompensa
    return !lastRewardMoment.isSame(currentMoment, 'day');
}

module.exports = {
    generateToken,
    sendPasswordResetEmail,
    sendWelcomeEmail,
    authenticateToken,
    authorizeAdmin,
    isNewDayForReward
};
