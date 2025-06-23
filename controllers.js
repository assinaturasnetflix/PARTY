// controllers.js

// ----------------------------------------
// 1. IMPORTAÇÕES E CONFIGURAÇÕES
// ----------------------------------------
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const moment = require('moment-timezone');
const { User, Plan, Video, Transaction, Deposit, Withdrawal, Settings } = require('./models');
const { generateToken, sendEmail, createWelcomeEmailHTML, createPasswordResetEmailHTML, cloudinary } = require('./utils');
const mongoose = require('mongoose');

// Função de wrapper para lidar com erros em funções async
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// Função para tratar erros de forma centralizada (será usada no server.js depois)
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode).json({
        message: err.message,
        // Em desenvolvimento, podemos querer a stack trace
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};


// ======================================================================================
//                                  AUTH CONTROLLER
// ======================================================================================
const authController = {
    /**
     * @desc    Registrar um novo usuário
     * @route   POST /api/auth/register
     * @access  Public
     */
    registerUser: asyncHandler(async (req, res) => {
        const { username, email, password, referralCode } = req.body;

        if (!username || !email || !password) {
            res.status(400);
            throw new Error('Por favor, preencha todos os campos obrigatórios.');
        }

        const userExists = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
        if (userExists) {
            res.status(400);
            throw new Error('Usuário ou e-mail já cadastrado.');
        }
        
        // Lógica de Referência no cadastro
        let referredBy = null;
        if (referralCode) {
            const referrer = await User.findOne({ referralCode });
            if (referrer) {
                referredBy = referrer._id;
            }
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await User.create({
            username,
            email: email.toLowerCase(),
            password: hashedPassword,
            referredBy,
            balance: 50, // Bônus de cadastro
        });
        
        // Criar transação de bônus de cadastro
        await Transaction.create({
            user: user._id,
            amount: 50,
            type: 'signup_bonus',
            description: 'Bônus de boas-vindas por cadastro.',
        });

        if (user) {
            // Enviar e-mail de boas-vindas
            const emailHtml = createWelcomeEmailHTML(user.username);
            sendEmail({
                to: user.email,
                subject: '🎉 Bem-vindo à VEED!',
                html: emailHtml
            }).catch(err => console.error("Falha ao enviar e-mail de boas-vindas:", err));

            res.status(201).json({
                _id: user._id,
                username: user.username,
                email: user.email,
                balance: user.balance,
                token: generateToken(user._id),
            });
        } else {
            res.status(400);
            throw new Error('Dados de usuário inválidos.');
        }
    }),

    /**
     * @desc    Autenticar (login) um usuário
     * @route   POST /api/auth/login
     * @access  Public
     */
    loginUser: asyncHandler(async (req, res) => {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });

        if (user && (await bcrypt.compare(password, user.password))) {
            if (user.isBlocked) {
                res.status(403);
                throw new Error('Sua conta está bloqueada. Por favor, entre em contacto com o suporte.');
            }
            res.json({
                _id: user._id,
                username: user.username,
                email: user.email,
                isAdmin: user.isAdmin,
                token: generateToken(user._id),
            });
        } else {
            res.status(401);
            throw new Error('E-mail ou senha inválidos.');
        }
    }),

    /**
     * @desc    Solicitar recuperação de senha
     * @route   POST /api/auth/forgot-password
     * @access  Public
     */
    forgotPassword: asyncHandler(async (req, res) => {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            res.status(404);
            throw new Error('Não existe um usuário com este e-mail.');
        }

        const resetToken = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutos

        await user.save();

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${resetToken}`;
        const emailHtml = createPasswordResetEmailHTML(resetUrl);
        
        try {
            await sendEmail({
                to: user.email,
                subject: 'VEED - Redefinição de Senha',
                html: emailHtml,
            });
            res.json({ message: 'E-mail de recuperação enviado com sucesso.' });
        } catch (error) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();
            res.status(500);
            throw new Error('Não foi possível enviar o e-mail de recuperação.');
        }
    }),

    /**
     * @desc    Redefinir a senha com o token
     * @route   PUT /api/auth/reset-password/:resetToken
     * @access  Public
     */
    resetPassword: asyncHandler(async (req, res) => {
        const resetToken = crypto.createHash('sha256').update(req.params.resetToken).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: resetToken,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            res.status(400);
            throw new Error('Token inválido ou expirado.');
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(req.body.password, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: 'Senha redefinida com sucesso.' });
    }),
};


// ======================================================================================
//                                SETTINGS CONTROLLER (Público)
// ======================================================================================
const settingsController = {
    /**
     * @desc    Obter as configurações do site (público)
     * @route   GET /api/settings
     * @access  Public
     */
    getSettings: asyncHandler(async (req, res) => {
        // Encontra ou cria o documento de configurações se ele não existir
        let settings = await Settings.findOne({ singletonId: 'main_settings' });
        if (!settings) {
            settings = await Settings.create({});
        }
        res.json(settings);
    }),
};

// ======================================================================================
//                                  USER CONTROLLER
// ======================================================================================
const userController = {
    /**
     * @desc    Obter perfil do usuário logado
     * @route   GET /api/user/me
     * @access  Private
     */
    getUserProfile: asyncHandler(async (req, res) => {
        // req.user é populado pelo middleware 'protect'
        const user = await User.findById(req.user.id).select('-password');
        if (user) {
            res.json(user);
        } else {
            res.status(404);
            throw new Error('Usuário não encontrado.');
        }
    }),

    /**
     * @desc    Atualizar detalhes do perfil do usuário
     * @route   PUT /api/user/update-details
     * @access  Private
     */
    updateUserDetails: asyncHandler(async (req, res) => {
        const user = await User.findById(req.user.id);
        const { username, email } = req.body;

        if (user) {
            // Verificar se o novo username ou email já está em uso por outro usuário
            const existingUser = await User.findOne({ 
                $or: [{ email }, { username }], 
                _id: { $ne: user._id }
            });
            if (existingUser) {
                res.status(400);
                throw new Error('Nome de usuário ou e-mail já está em uso.');
            }

            user.username = username || user.username;
            user.email = email || user.email;
            const updatedUser = await user.save();

            res.json({
                _id: updatedUser._id,
                username: updatedUser.username,
                email: updatedUser.email,
            });
        } else {
            res.status(404);
            throw new Error('Usuário não encontrado.');
        }
    }),

     /**
     * @desc    Atualizar senha do usuário logado
     * @route   PUT /api/user/update-password
     * @access  Private
     */
    updateUserPassword: asyncHandler(async (req, res) => {
        const user = await User.findById(req.user.id);
        const { oldPassword, newPassword } = req.body;

        if (!user || !(await bcrypt.compare(oldPassword, user.password))) {
            res.status(401);
            throw new Error('Senha antiga incorreta.');
        }
        
        if (newPassword.length < 6) {
             res.status(400);
             throw new Error('A nova senha deve ter no mínimo 6 caracteres.');
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();
        
        res.json({ message: 'Senha alterada com sucesso.' });
    }),

    /**
     * @desc    Fazer upload do avatar do usuário
     * @route   POST /api/user/avatar
     * @access  Private
     */
    uploadAvatar: asyncHandler(async (req, res) => {
        const user = await User.findById(req.user.id);

        if (!req.file) {
            res.status(400);
            throw new Error('Nenhum arquivo foi enviado.');
        }

        // Se já existe um avatar, apaga o antigo do Cloudinary
        if (user.avatar && user.avatar.cloudinary_id) {
            await cloudinary.uploader.destroy(user.avatar.cloudinary_id);
        }

        user.avatar = {
            url: req.file.path,
            cloudinary_id: req.file.filename,
        };
        await user.save();
        
        res.json({
            message: 'Avatar atualizado com sucesso!',
            avatarUrl: user.avatar.url,
        });
    }),
};


// ======================================================================================
//                                  PLAN CONTROLLER
// ======================================================================================
const planController = {
    /**
     * @desc    Obter todos os planos ativos
     * @route   GET /api/plans
     * @access  Public
     */
    getAllActivePlans: asyncHandler(async (req, res) => {
        const plans = await Plan.find({ isActive: true });
        res.json(plans);
    }),

    /**
     * @desc    Comprar/Ativar um plano
     * @route   POST /api/plans/buy/:planId
     * @access  Private
     */
    buyPlan: asyncHandler(async (req, res) => {
        const plan = await Plan.findById(req.params.planId);
        const user = await User.findById(req.user.id);

        if (!plan || !plan.isActive) {
            res.status(404);
            throw new Error('Plano não encontrado ou inativo.');
        }

        if (user.activePlan && user.activePlan.expiryDate > new Date()) {
            res.status(400);
            throw new Error('Você já possui um plano ativo.');
        }
        
        if (user.balance < plan.cost) {
            res.status(400);
            throw new Error('Saldo insuficiente para comprar este plano.');
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // 1. Deduzir o saldo do usuário
            user.balance -= plan.cost;

            // 2. Ativar o plano para o usuário
            const activationDate = new Date();
            const expiryDate = new Date();
            expiryDate.setDate(activationDate.getDate() + plan.durationInDays);
            
            user.activePlan = {
                planId: plan._id,
                name: plan.name,
                activationDate,
                expiryDate,
            };
            await user.save({ session });

            // 3. Criar a transação de compra
            await Transaction.create([{
                user: user._id,
                amount: -plan.cost,
                type: 'plan_purchase',
                description: `Compra do plano "${plan.name}"`,
            }], { session });

            // 4. Lógica de bônus de referência
            if (user.referredBy) {
                const referrer = await User.findById(user.referredBy);
                if (referrer) {
                    const bonus = plan.cost * 0.10; // 10% do valor do plano
                    referrer.balance += bonus;
                    await referrer.save({ session });
                    
                    await Transaction.create([{
                        user: referrer._id,
                        amount: bonus,
                        type: 'referral_plan',
                        description: `Bônus de 10% pela ativação do plano de ${user.username}`,
                        referenceId: user._id
                    }], { session });
                }
            }
            
            await session.commitTransaction();
            res.json({ message: `Plano "${plan.name}" ativado com sucesso!` });

        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }),
};

// ======================================================================================
//                                  VIDEO CONTROLLER
// ======================================================================================

/**
 * Função auxiliar para resetar os vídeos diários
 * @param {object} user - O objeto do usuário do Mongoose
 */
const checkAndResetDailyVideos = async (user) => {
    const maputoTimezone = 'Africa/Maputo';
    const nowInMaputo = moment.tz(maputoTimezone);
    const startOfTodayInMaputo = nowInMaputo.startOf('day').toDate();

    if (!user.lastVideoReset || user.lastVideoReset < startOfTodayInMaputo) {
        user.dailyWatchedVideos = [];
        user.lastVideoReset = new Date();
        await user.save();
    }
};

const videoController = {
    /**
     * @desc    Obter os vídeos do dia para o usuário
     * @route   GET /api/videos/daily
     * @access  Private
     */
    getDailyVideos: asyncHandler(async (req, res) => {
        const user = await User.findById(req.user.id).populate('activePlan.planId');
        
        if (!user.activePlan || !user.activePlan.planId || user.activePlan.expiryDate < new Date()) {
            res.status(403);
            throw new Error('Você não tem um plano ativo para assistir vídeos.');
        }

        // Resetar a contagem diária se necessário
        await checkAndResetDailyVideos(user);
        
        const plan = user.activePlan.planId;
        const videosToWatchCount = plan.dailyVideoLimit - user.dailyWatchedVideos.length;

        if (videosToWatchCount <= 0) {
            return res.json({ message: "Você já assistiu todos os vídeos de hoje.", videos: [] });
        }

        // IDs dos vídeos já assistidos na história completa do usuário
        const watchedHistoryIds = user.fullWatchedHistory || [];

        // Encontrar vídeos que o usuário NUNCA assistiu
        const availableVideos = await Video.find({ _id: { $nin: watchedHistoryIds } }).limit(videosToWatchCount);
        
        // Se não houver vídeos novos suficientes, preenche com vídeos aleatórios (exceto os de hoje)
        if (availableVideos.length < videosToWatchCount) {
             const alreadyWatchedTodayIds = user.dailyWatchedVideos.map(v => v.videoId);
             const moreVideos = await Video.aggregate([
                 { $match: { _id: { $nin: [...watchedHistoryIds, ...alreadyWatchedTodayIds] } } },
                 { $sample: { size: videosToWatchCount - availableVideos.length } }
             ]);
             availableVideos.push(...moreVideos);
        }
        
        res.json({ videos: availableVideos });
    }),

    /**
     * @desc    Marcar um vídeo como assistido e receber recompensa
     * @route   POST /api/videos/watch/:videoId
     * @access  Private
     */
    markVideoAsWatched: asyncHandler(async (req, res) => {
        const { videoId } = req.params;
        const user = await User.findById(req.user.id).populate('activePlan.planId');

        if (!user.activePlan || !user.activePlan.planId || user.activePlan.expiryDate < new Date()) {
            res.status(403);
            throw new Error('Você não tem um plano ativo.');
        }
        
        await checkAndResetDailyVideos(user);

        const plan = user.activePlan.planId;

        // Verificar se o limite diário já foi atingido
        if (user.dailyWatchedVideos.length >= plan.dailyVideoLimit) {
            res.status(400);
            throw new Error('Você já atingiu seu limite de vídeos por hoje.');
        }

        // Verificar se este vídeo específico já foi creditado hoje
        const alreadyWatchedToday = user.dailyWatchedVideos.some(v => v.videoId.toString() === videoId);
        if (alreadyWatchedToday) {
            res.status(400);
            throw new Error('A recompensa para este vídeo já foi creditada hoje.');
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const rewardAmount = plan.rewardPerVideo;

            // 1. Adicionar vídeo à lista de assistidos do dia e ao histórico geral
            user.dailyWatchedVideos.push({ videoId });
            user.fullWatchedHistory.addToSet(videoId);

            // 2. Creditar a recompensa
            user.balance += rewardAmount;
            await user.save({ session });
            
            // 3. Criar transação da recompensa
            await Transaction.create([{
                user: user._id,
                amount: rewardAmount,
                type: 'daily_reward',
                description: `Recompensa por assistir vídeo.`,
                referenceId: videoId
            }], { session });

            // 4. Lógica de bônus de referência (5% do ganho diário)
            if (user.referredBy) {
                const referrer = await User.findById(user.referredBy);
                if (referrer) {
                    const dailyBonus = rewardAmount * 0.05; // 5% da recompensa do vídeo
                    referrer.balance += dailyBonus;
                    await referrer.save({ session });
                    
                    await Transaction.create([{
                        user: referrer._id,
                        amount: dailyBonus,
                        type: 'referral_daily',
                        description: `Bônus de 5% sobre o ganho diário de ${user.username}`,
                        referenceId: user._id
                    }], { session });
                }
            }

            await session.commitTransaction();
            res.json({ message: 'Recompensa creditada!', newBalance: user.balance });

        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }),
};


// ======================================================================================
//                                  WALLET CONTROLLER
// ======================================================================================
const walletController = {
    /**
     * @desc    Obter detalhes da carteira (saldo e histórico)
     * @route   GET /api/wallet
     * @access  Private
     */
    getWalletDetails: asyncHandler(async (req, res) => {
        const user = await User.findById(req.user.id).select('balance');
        const transactions = await Transaction.find({ user: req.user.id }).sort({ createdAt: -1 });

        res.json({
            balance: user.balance,
            transactions,
        });
    }),

    /**
     * @desc    Solicitar um depósito manual
     * @route   POST /api/wallet/deposit
     * @access  Private
     */
    requestDeposit: asyncHandler(async (req, res) => {
        const { amount, paymentMethod, proofText } = req.body;

        if (!amount || !paymentMethod) {
            res.status(400);
            throw new Error('Valor e método de pagamento são obrigatórios.');
        }
        if (!req.file && !proofText) {
            res.status(400);
            throw new Error('É necessário enviar um comprovativo (imagem ou texto).');
        }

        const depositData = {
            user: req.user.id,
            amount,
            paymentMethod,
            proof: {}
        };

        if (req.file) {
            depositData.proof.imageUrl = req.file.path;
            depositData.proof.imageCloudinaryId = req.file.filename;
        }
        if (proofText) {
            depositData.proof.text = proofText;
        }

        await Deposit.create(depositData);
        res.status(201).json({ message: 'Pedido de depósito enviado com sucesso. Aguarde a aprovação do administrador.' });
    }),
    
    /**
     * @desc    Solicitar um levantamento
     * @route   POST /api/wallet/withdraw
     * @access  Private
     */
    requestWithdrawal: asyncHandler(async (req, res) => {
        const { amount, paymentMethod, phoneNumber } = req.body;
        const user = await User.findById(req.user.id);

        if (!amount || !paymentMethod || !phoneNumber) {
            res.status(400);
            throw new Error('Todos os campos são obrigatórios.');
        }
        
        // Regra: só pode sacar se tiver um plano ativo
        if (!user.activePlan || !user.activePlan.planId || user.activePlan.expiryDate < new Date()) {
            res.status(403);
            throw new Error('É necessário ter um plano ativo para solicitar levantamentos.');
        }

        if (user.balance < amount) {
            res.status(400);
            throw new Error('Saldo insuficiente para o levantamento.');
        }
        
        // Criar o pedido de levantamento
        await Withdrawal.create({
            user: user._id,
            amount,
            paymentMethod,
            phoneNumber,
            status: 'pending'
        });

        res.status(201).json({ message: 'Pedido de levantamento enviado com sucesso. O administrador irá processá-lo manualmente.' });
    }),
};


// ======================================================================================
//                                REFERRAL CONTROLLER
// ======================================================================================
const referralController = {
    /**
     * @desc    Obter dados de referência do usuário
     * @route   GET /api/referrals
     * @access  Private
     */
    getReferralData: asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const user = await User.findById(userId).select('referralCode');

        // Calcular ganhos totais com referências
        const earnings = await Transaction.aggregate([
            { $match: { user: userId, type: { $in: ['referral_plan', 'referral_daily'] } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // Encontrar usuários indicados
        const referredUsers = await User.find({ referredBy: userId }).select('username email createdAt');

        res.json({
            referralLink: `${process.env.FRONTEND_URL}/register.html?ref=${user.referralCode}`,
            referralCode: user.referralCode,
            totalEarnings: earnings.length > 0 ? earnings[0].total : 0,
            referredUsersCount: referredUsers.length,
            referredUsers: referredUsers
        });
    }),
};


// ======================================================================================
// ======================================================================================
//                                  ADMIN CONTROLLERS
// ======================================================================================
// ======================================================================================

// ======================================================================================
//                                ADMIN SETTINGS CONTROLLER
// ======================================================================================
const adminSettingsController = {
     /**
     * @desc    Atualizar as configurações do site
     * @route   PUT /api/admin/settings
     * @access  Private/Admin
     */
    updateSettings: asyncHandler(async (req, res) => {
        const { mpesaNumber, emolaNumber, depositInstructions } = req.body;
        
        const updatedSettings = await Settings.findOneAndUpdate(
            { singletonId: 'main_settings' },
            { mpesaNumber, emolaNumber, depositInstructions },
            { new: true, upsert: true } // new: retorna o doc atualizado, upsert: cria se não existir
        );
        
        res.json(updatedSettings);
    }),
};
// ======================================================================================
//                                ADMIN DASHBOARD CONTROLLER
// ======================================================================================
const adminDashboardController = {
    /**
     * @desc    Obter estatísticas gerais da plataforma
     * @route   GET /api/admin/stats
     * @access  Private/Admin
     */
    getDashboardStats: asyncHandler(async (req, res) => {
        const totalUsers = await User.countDocuments();
        const pendingDeposits = await Deposit.countDocuments({ status: 'pending' });
        const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'pending' });
        
        const totalRevenueResult = await Transaction.aggregate([
            { $match: { type: 'plan_purchase' } },
            { $group: { _id: null, total: { $sum: '$amount' } } } // amount é negativo, então usamos -
        ]);
        const totalRevenue = totalRevenueResult.length > 0 ? -totalRevenueResult[0].total : 0;

        const totalPaidOutResult = await Transaction.aggregate([
            { $match: { type: { $in: ['daily_reward', 'referral_daily', 'referral_plan'] } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalPaidOut = totalPaidOutResult.length > 0 ? totalPaidOutResult[0].total : 0;

        const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).select('username email createdAt');

        res.json({
            totalUsers,
            pendingDeposits,
            pendingWithdrawals,
            totalRevenue,
            totalPaidOut,
            recentUsers
        });
    }),
};

// ======================================================================================
//                                ADMIN USER CONTROLLER
// ======================================================================================
const adminUserController = {
    /**
     * @desc    Obter todos os usuários
     * @route   GET /api/admin/users
     * @access  Private/Admin
     */
    getAllUsers: asyncHandler(async (req, res) => {
        const users = await User.find({}).select('-password');
        res.json(users);
    }),

    /**
     * @desc    Obter um usuário por ID
     * @route   GET /api/admin/users/:userId
     * @access  Private/Admin
     */
    getUserById: asyncHandler(async (req, res) => {
        const user = await User.findById(req.params.userId).select('-password').populate('referredBy', 'username email');
        const transactions = await Transaction.find({ user: req.params.userId }).sort({ createdAt: -1 }).limit(20);
        
        if (!user) {
            res.status(404);
            throw new Error('Usuário não encontrado.');
        }
        res.json({ user, transactions });
    }),

    /**
     * @desc    Bloquear/Desbloquear um usuário
     * @route   PUT /api/admin/users/:userId/toggle-block
     * @access  Private/Admin
     */
    toggleBlockUser: asyncHandler(async (req, res) => {
        const user = await User.findById(req.params.userId);
        if (!user) {
            res.status(404);
            throw new Error('Usuário não encontrado.');
        }
        user.isBlocked = !user.isBlocked;
        await user.save();
        res.json({ message: `Usuário ${user.isBlocked ? 'bloqueado' : 'desbloqueado'} com sucesso.` });
    }),
    
    /**
     * @desc    Adicionar ou remover saldo manualmente
     * @route   POST /api/admin/users/:userId/manual-balance
     * @access  Private/Admin
     */
    manualBalanceUpdate: asyncHandler(async (req, res) => {
        const { amount, description } = req.body; // amount pode ser positivo ou negativo
        const user = await User.findById(req.params.userId);

        if (!user) {
            res.status(404);
            throw new Error('Usuário não encontrado.');
        }
        if (!amount || !description) {
            res.status(400);
            throw new Error('Valor e descrição são obrigatórios.');
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            user.balance += amount;
            if (user.balance < 0) {
                throw new Error('O saldo do usuário não pode ficar negativo.');
            }
            await user.save({ session });

            await Transaction.create([{
                user: user._id,
                amount: amount,
                type: amount > 0 ? 'admin_credit' : 'admin_debit',
                description: `Ajuste manual: ${description}`
            }], { session });

            await session.commitTransaction();
            res.json({ message: 'Saldo atualizado com sucesso.', newBalance: user.balance });
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }),
};

// ======================================================================================
//                                ADMIN PLAN CONTROLLER
// ======================================================================================
const adminPlanController = {
     /**
     * @desc    Criar um novo plano
     * @route   POST /api/admin/plans
     * @access  Private/Admin
     */
    createPlan: asyncHandler(async (req, res) => {
        const { name, cost, dailyVideoLimit, durationInDays, rewardPerVideo } = req.body;
        const totalReward = dailyVideoLimit * durationInDays * rewardPerVideo;

        const plan = await Plan.create({
            name,
            cost,
            dailyVideoLimit,
            durationInDays,
            rewardPerVideo,
            totalReward
        });
        res.status(201).json(plan);
    }),

    /**
     * @desc    Obter todos os planos (ativos e inativos)
     * @route   GET /api/admin/plans/all
     * @access  Private/Admin
     */
    getAllPlans: asyncHandler(async (req, res) => {
        const plans = await Plan.find({});
        res.json(plans);
    }),

    /**
     * @desc    Atualizar um plano
     * @route   PUT /api/admin/plans/:planId
     * @access  Private/Admin
     */
    updatePlan: asyncHandler(async (req, res) => {
        const { name, cost, dailyVideoLimit, durationInDays, rewardPerVideo, isActive } = req.body;
        const plan = await Plan.findById(req.params.planId);

        if (!plan) {
            res.status(404);
            throw new Error('Plano não encontrado.');
        }

        plan.name = name || plan.name;
        plan.cost = cost || plan.cost;
        plan.dailyVideoLimit = dailyVideoLimit || plan.dailyVideoLimit;
        plan.durationInDays = durationInDays || plan.durationInDays;
        plan.rewardPerVideo = rewardPerVideo || plan.rewardPerVideo;
        plan.isActive = isActive !== undefined ? isActive : plan.isActive;
        plan.totalReward = (plan.dailyVideoLimit * plan.durationInDays * plan.rewardPerVideo);

        const updatedPlan = await plan.save();
        res.json(updatedPlan);
    }),

    /**
     * @desc    Apagar um plano
     * @route   DELETE /api/admin/plans/:planId
     * @access  Private/Admin
     */
    deletePlan: asyncHandler(async (req, res) => {
        // Cuidado: apagar um plano pode causar problemas se usuários ainda o tiverem ativo.
        // Uma abordagem melhor é desativá-lo (isActive: false)
        const plan = await Plan.findById(req.params.planId);
        if(!plan) {
            res.status(404);
            throw new Error('Plano não encontrado');
        }
        await plan.remove();
        res.json({ message: 'Plano removido com sucesso.' });
    }),
};


// ======================================================================================
//                                ADMIN VIDEO CONTROLLER
// ======================================================================================
const adminVideoController = {
    /**
     * @desc    Fazer upload de um novo vídeo
     * @route   POST /api/admin/videos/upload
     * @access  Private/Admin
     */
    uploadVideo: asyncHandler(async (req, res) => {
        const { title } = req.body;
        if (!req.file) {
            res.status(400);
            throw new Error('Nenhum arquivo de vídeo enviado.');
        }

        const video = await Video.create({
            title,
            url: req.file.path,
            cloudinary_id: req.file.filename,
            uploader: req.user.id
        });
        res.status(201).json(video);
    }),

    /**
     * @desc    Obter todos os vídeos
     * @route   GET /api/admin/videos
     * @access  Private/Admin
     */
    getAllVideos: asyncHandler(async (req, res) => {
        const videos = await Video.find({}).populate('uploader', 'username');
        res.json(videos);
    }),

    /**
     * @desc    Apagar um vídeo
     * @route   DELETE /api/admin/videos/:videoId
     * @access  Private/Admin
     */
    deleteVideo: asyncHandler(async (req, res) => {
        const video = await Video.findById(req.params.videoId);

        if (!video) {
            res.status(404);
            throw new Error('Vídeo não encontrado.');
        }

        // Apagar do Cloudinary
        await cloudinary.uploader.destroy(video.cloudinary_id, { resource_type: 'video' });
        // Apagar do DB
        await video.remove();
        
        // Opcional: remover o ID do vídeo dos históricos dos usuários
        await User.updateMany({}, { $pull: { fullWatchedHistory: video._id } });

        res.json({ message: 'Vídeo removido com sucesso.' });
    }),
};


// ======================================================================================
//                                ADMIN FINANCE CONTROLLER
// ======================================================================================
const adminFinanceController = {
    /**
     * @desc    Obter depósitos (com filtro opcional por status)
     * @route   GET /api/admin/deposits
     * @access  Private/Admin
     */
    getDeposits: asyncHandler(async (req, res) => {
        const query = req.query.status ? { status: req.query.status } : {};
        const deposits = await Deposit.find(query).populate('user', 'username email').sort({ createdAt: -1 });
        res.json(deposits);
    }),

    /**
     * @desc    Aprovar um depósito
     * @route   PUT /api/admin/deposits/:depositId/approve
     * @access  Private/Admin
     */
    approveDeposit: asyncHandler(async (req, res) => {
        const deposit = await Deposit.findById(req.params.depositId);

        if (!deposit || deposit.status !== 'pending') {
            res.status(404);
            throw new Error('Depósito não encontrado ou já processado.');
        }
        
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const user = await User.findById(deposit.user);
            user.balance += deposit.amount;
            await user.save({ session });

            deposit.status = 'approved';
            await deposit.save({ session });

            await Transaction.create([{
                user: user._id,
                amount: deposit.amount,
                type: 'deposit',
                description: `Depósito via ${deposit.paymentMethod} aprovado.`,
                referenceId: deposit._id
            }], { session });

            await session.commitTransaction();
            res.json({ message: 'Depósito aprovado com sucesso.' });
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }),

    /**
     * @desc    Rejeitar um depósito
     * @route   PUT /api/admin/deposits/:depositId/reject
     * @access  Private/Admin
     */
    rejectDeposit: asyncHandler(async (req, res) => {
        const deposit = await Deposit.findById(req.params.depositId);
        if (!deposit || deposit.status !== 'pending') {
            res.status(404);
            throw new Error('Depósito não encontrado ou já processado.');
        }

        deposit.status = 'rejected';
        deposit.adminNotes = req.body.reason || 'Sem motivo especificado.';
        await deposit.save();
        res.json({ message: 'Depósito rejeitado.' });
    }),

    /**
     * @desc    Obter levantamentos (com filtro opcional por status)
     * @route   GET /api/admin/withdrawals
     * @access  Private/Admin
     */
    getWithdrawals: asyncHandler(async (req, res) => {
        const query = req.query.status ? { status: req.query.status } : {};
        const withdrawals = await Withdrawal.find(query).populate('user', 'username email').sort({ createdAt: -1 });
        res.json(withdrawals);
    }),

    /**
     * @desc    Aprovar um levantamento
     * @route   PUT /api/admin/withdrawals/:withdrawalId/approve
     * @access  Private/Admin
     */
    approveWithdrawal: asyncHandler(async (req, res) => {
        const withdrawal = await Withdrawal.findById(req.params.withdrawalId);

        if (!withdrawal || withdrawal.status !== 'pending') {
            res.status(404);
            throw new Error('Levantamento não encontrado ou já processado.');
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const user = await User.findById(withdrawal.user);
            
            if (user.balance < withdrawal.amount) {
                // Se o saldo do usuário mudou e não é mais suficiente, rejeita a transação
                withdrawal.status = 'rejected';
                withdrawal.adminNotes = 'Saldo insuficiente no momento da aprovação.';
                await withdrawal.save({ session });
                await session.commitTransaction();
                res.status(400);
                throw new Error('Saldo do usuário insuficiente. O levantamento foi rejeitado.');
            }
            
            user.balance -= withdrawal.amount;
            await user.save({ session });
            
            withdrawal.status = 'approved';
            await withdrawal.save({ session });

            await Transaction.create([{
                user: user._id,
                amount: -withdrawal.amount,
                type: 'withdrawal',
                description: `Levantamento para ${withdrawal.phoneNumber} aprovado.`,
                referenceId: withdrawal._id
            }], { session });

            await session.commitTransaction();
            res.json({ message: 'Levantamento aprovado com sucesso.' });

        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }),

    /**
     * @desc    Rejeitar um levantamento
     * @route   PUT /api/admin/withdrawals/:withdrawalId/reject
     * @access  Private/Admin
     */
    rejectWithdrawal: asyncHandler(async (req, res) => {
        const withdrawal = await Withdrawal.findById(req.params.withdrawalId);
        if (!withdrawal || withdrawal.status !== 'pending') {
            res.status(404);
            throw new Error('Levantamento não encontrado ou já processado.');
        }

        withdrawal.status = 'rejected';
        withdrawal.adminNotes = req.body.reason || 'Sem motivo especificado.';
        await withdrawal.save();
        res.json({ message: 'Levantamento rejeitado.' });
    }),
};


// ======================================================================================
//                                  EXPORTAÇÃO
// ======================================================================================
module.exports = {
    errorHandler,
    authController,
    userController,
    planController,
    videoController,
    walletController,
    referralController,
    adminDashboardController,
    adminUserController,
    adminPlanController,
    adminVideoController,
    adminFinanceController,
    settingsController,
    adminSettingsController
};