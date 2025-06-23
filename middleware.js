// middleware.js

const jwt = require('jsonwebtoken');
const { User } = require('./models');

// Função de wrapper para lidar com erros em funções async
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/**
 * @desc    Middleware para proteger rotas. Verifica se o usuário está logado via token JWT.
 */
const protect = asyncHandler(async (req, res, next) => {
    let token;

    // Verifica se o token está no cabeçalho de autorização e começa com "Bearer"
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Extrai o token do cabeçalho (formato: "Bearer TOKEN_AQUI")
            token = req.headers.authorization.split(' ')[1];

            // Verifica e decodifica o token usando o segredo
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Encontra o usuário pelo ID contido no token e anexa ao objeto 'req'
            // O '.select('-password')' evita que a senha do usuário seja anexada
            req.user = await User.findById(decoded.id).select('-password');
            
            if (!req.user) {
                res.status(401);
                throw new Error('Não autorizado, usuário não encontrado.');
            }

            next(); // Se tudo estiver OK, prossegue para a próxima função (o controller da rota)
        } catch (error) {
            console.error(error);
            res.status(401);
            throw new Error('Não autorizado, token inválido.');
        }
    }

    if (!token) {
        res.status(401);
        throw new Error('Não autorizado, nenhum token fornecido.');
    }
});

/**
 * @desc    Middleware para rotas de administrador. Verifica se o usuário logado é um admin.
 * Deve ser usado SEMPRE DEPOIS do middleware 'protect'.
 */
const admin = (req, res, next) => {
    // Verifica se o objeto 'req.user' foi preenchido pelo middleware 'protect' e se 'isAdmin' é true.
    // Lembre-se que precisamos adicionar o campo 'isAdmin: { type: Boolean, default: false }' ao UserSchema.
    if (req.user && req.user.isAdmin) {
        next(); // Se for admin, prossegue.
    } else {
        res.status(403); // 403 Forbidden - O cliente é conhecido, mas não tem permissão.
        throw new Error('Acesso negado. Apenas administradores podem executar esta ação.');
    }
};

module.exports = { protect, admin };