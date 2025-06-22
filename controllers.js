// controllers.js
const bcrypt = require('bcryptjs');
const { User, Plan, Video, Deposit, Withdrawal, Transaction, AdminSettings } = require('./models');
const { generateToken, sendPasswordResetEmail, sendWelcomeEmail, getMaputoDate, isValidEmail } = require('./utils');
const cloudinary = require('cloudinary').v2;
const moment = require('moment-timezone'); // Já está incluído em utils, mas para garantir
const crypto = require('crypto'); // Para gerar tokens de recuperação de senha

// Configuração do Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Middleware de autenticação
const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');
            if (!req.user) {
                return res.status(401).json({ message: 'Usuário não encontrado. Token inválido.' });
            }
            next();
        } catch (error) {
            console.error('Erro de autenticação:', error);
            res.status(401).json({ message: 'Não autorizado, token falhou ou expirou.' });
        }
    }
    if (!token) {
        res.status(401).json({ message: 'Não autorizado, nenhum token.' });
    }
};

// Middleware de autorização para Admin
const admin = (req, res, next) => {
    // Para simplificar, vamos definir um usuário admin por email ou outro identificador
    // Em uma aplicação real, você teria um campo 'role' no modelo User (ex: 'user', 'admin')
    if (req.user && req.user.email === 'seuemailadmin@exemplo.com') { // Substitua pelo email do seu admin
        next();
    } else {
        res.status(403).json({ message: 'Não autorizado como admin.' });
    }
};


// --- User Controllers ---

// Registrar novo usuário
const registerUser = async (req, res) => {
    const { username, email, password, referralCode } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Por favor, preencha todos os campos.' });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({ message: 'Formato de e-mail inválido.' });
    }

    try {
        const userExists = await User.findOne({ $or: [{ username }, { email }] });
        if (userExists) {
            return res.status(400).json({ message: 'Nome de usuário ou e-mail já registrado.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        let referredBy = null;
        if (referralCode) {
            const referrer = await User.findOne({ referralCode });
            if (referrer) {
                referredBy = referrer._id;
            } else {
                return res.status(400).json({ message: 'Código de referência inválido.' });
            }
        }

        const newUser = await User.create({
            username,
            email,
            password: hashedPassword,
            referralCode: crypto.randomBytes(6).toString('hex').toUpperCase(), // Gera um código de referência único
            referredBy,
        });

        if (newUser) {
            // Enviar email de boas-vindas
            await sendWelcomeEmail(newUser.email, newUser.username);

            res.status(201).json({
                _id: newUser._id,
                username: newUser.username,
                email: newUser.email,
                balance: newUser.balance,
                token: generateToken(newUser._id),
                message: 'Usuário registrado com sucesso! Um e-mail de boas-vindas foi enviado.'
            });
        } else {
            res.status(400).json({ message: 'Dados do usuário inválidos.' });
        }

    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        res.status(500).json({ message: 'Erro do servidor ao registrar usuário.' });
    }
};

// Autenticar usuário e gerar token
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Por favor, preencha todos os campos.' });
    }

    try {
        const user = await User.findOne({ email });

        if (user && (await bcrypt.compare(password, user.password))) {
            if (!user.isActive) {
                return res.status(403).json({ message: 'Sua conta está bloqueada. Entre em contato com o suporte.' });
            }
            res.json({
                _id: user._id,
                username: user.username,
                email: user.email,
                balance: user.balance,
                avatar: user.avatar,
                referralCode: user.referralCode,
                currentPlan: user.currentPlan,
                planActivationDate: user.planActivationDate,
                videosWatchedTodayCount: user.videosWatchedTodayCount,
                token: generateToken(user._id),
                message: 'Login bem-sucedido.'
            });
        } else {
            res.status(401).json({ message: 'Credenciais inválidas.' });
        }
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        res.status(500).json({ message: 'Erro do servidor ao fazer login.' });
    }
};

// Obter perfil do usuário
const getUserProfile = async (req, res) => {
    // O usuário já está disponível em req.user pelo middleware `protect`
    const user = req.user;
    if (user) {
        // Popule os dados do plano se existir
        const userWithPlan = await User.findById(user._id)
            .select('-password')
            .populate('currentPlan', 'name videosPerDay durationDays dailyReward totalReward');

        res.json(userWithPlan);
    } else {
        res.status(404).json({ message: 'Usuário não encontrado.' });
    }
};

// Atualizar perfil do usuário
const updateUserProfile = async (req, res) => {
    const user = req.user; // Usuário do token
    const { username, email, password } = req.body;

    if (user) {
        user.username = username || user.username;
        user.email = email || user.email;

        if (password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
        }

        try {
            const updatedUser = await user.save();
            res.json({
                _id: updatedUser._id,
                username: updatedUser.username,
                email: updatedUser.email,
                balance: updatedUser.balance,
                avatar: updatedUser.avatar,
                token: generateToken(updatedUser._id),
                message: 'Perfil atualizado com sucesso.'
            });
        } catch (error) {
            console.error('Erro ao atualizar perfil:', error);
            if (error.code === 11000) { // Erro de duplicidade (email/username já existe)
                return res.status(400).json({ message: 'Nome de usuário ou e-mail já está em uso.' });
            }
            res.status(500).json({ message: 'Erro do servidor ao atualizar perfil.' });
        }
    } else {
        res.status(404).json({ message: 'Usuário não encontrado.' });
    }
};

// Upload de avatar do usuário
const uploadUserAvatar = async (req, res) => {
    const user = req.user;

    if (!req.file) {
        return res.status(400).json({ message: 'Por favor, envie um arquivo de imagem.' });
    }

    try {
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'veed_avatars',
            width: 150,
            height: 150,
            crop: 'fill'
        });

        user.avatar = result.secure_url;
        await user.save();

        // Limpar o arquivo temporário do multer
        const fs = require('fs');
        fs.unlinkSync(req.file.path);

        res.json({
            message: 'Avatar atualizado com sucesso!',
            avatarUrl: user.avatar
        });
    } catch (error) {
        console.error('Erro ao fazer upload do avatar:', error);
        res.status(500).json({ message: 'Erro ao fazer upload do avatar.' });
    }
};

// Solicitar recuperação de senha
const forgotPassword = async (req, res) => {
    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
        return res.status(400).json({ message: 'Por favor, forneça um e-mail válido.' });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            // Para segurança, não informamos se o email existe ou não
            return res.status(200).json({ message: 'Se o e-mail estiver registrado, um link de redefinição será enviado.' });
        }

        // Gera um token único para recuperação de senha
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.passwordResetToken = resetToken;
        user.passwordResetExpires = Date.now() + 3600000; // 1 hora de validade

        await user.save();

        await sendPasswordResetEmail(user.email, resetToken);

        res.status(200).json({ message: 'Um link de redefinição de senha foi enviado para o seu e-mail.' });

    } catch (error) {
        console.error('Erro em forgotPassword:', error);
        res.status(500).json({ message: 'Erro do servidor ao solicitar redefinição de senha.' });
    }
};

// Redefinir senha
const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token e nova senha são obrigatórios.' });
    }

    try {
        const user = await User.findOne({
            passwordResetToken: token,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Token inválido ou expirado.' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;

        await user.save();

        res.status(200).json({ message: 'Senha redefinida com sucesso!' });

    } catch (error) {
        console.error('Erro em resetPassword:', error);
        res.status(500).json({ message: 'Erro do servidor ao redefinir senha.' });
    }
};

// --- Plan Controllers ---

// Criar novo plano (Admin)
const createPlan = async (req, res) => {
    const { name, value, videosPerDay, durationDays, totalReward, dailyReward } = req.body;

    if (!name || !value || !videosPerDay || !durationDays || !totalReward || !dailyReward) {
        return res.status(400).json({ message: 'Todos os campos do plano são obrigatórios.' });
    }

    try {
        const planExists = await Plan.findOne({ name });
        if (planExists) {
            return res.status(400).json({ message: 'Já existe um plano com este nome.' });
        }

        const newPlan = await Plan.create({
            name,
            value,
            videosPerDay,
            durationDays,
            totalReward,
            dailyReward
        });

        res.status(201).json({ message: 'Plano criado com sucesso!', plan: newPlan });
    } catch (error) {
        console.error('Erro ao criar plano:', error);
        res.status(500).json({ message: 'Erro do servidor ao criar plano.' });
    }
};

// Obter todos os planos
const getAllPlans = async (req, res) => {
    try {
        const plans = await Plan.find({});
        res.status(200).json(plans);
    } catch (error) {
        console.error('Erro ao obter planos:', error);
        res.status(500).json({ message: 'Erro do servidor ao obter planos.' });
    }
};

// Comprar plano (Usuário)
const purchasePlan = async (req, res) => {
    const userId = req.user._id;
    const { planId } = req.body;

    if (!planId) {
        return res.status(400).json({ message: 'ID do plano é obrigatório.' });
    }

    try {
        const user = await User.findById(userId);
        const plan = await Plan.findById(planId);

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        if (!plan) {
            return res.status(404).json({ message: 'Plano não encontrado.' });
        }
        if (user.currentPlan && user.currentPlan.toString() === planId) {
            return res.status(400).json({ message: 'Você já possui este plano ativo.' });
        }
        if (user.balance < plan.value) {
            return res.status(400).json({ message: 'Saldo insuficiente para comprar este plano. Por favor, deposite.' });
        }

        // Deduzir o valor do plano do saldo do usuário
        user.balance -= plan.value;
        user.currentPlan = plan._id;
        user.planActivationDate = getMaputoDate().toDate(); // Data de ativação do plano
        user.videosWatchedTodayCount = 0; // Zera a contagem de vídeos para o novo plano
        user.watchedVideosHistory = []; // Zera o histórico de vídeos assistidos para o novo plano

        await user.save();

        // Registrar a transação
        await Transaction.create({
            userId: user._id,
            type: 'plan_purchase',
            amount: -plan.value, // Negativo porque é uma despesa
            description: `Compra do plano: ${plan.name}`,
            relatedId: plan._id
        });

        // Recompensa para o referenciador (10% do valor do plano)
        if (user.referredBy) {
            const referrer = await User.findById(user.referredBy);
            if (referrer) {
                const referralBonus = plan.value * 0.10;
                referrer.balance += referralBonus;
                await referrer.save();

                await Transaction.create({
                    userId: referrer._id,
                    type: 'referral_plan_bonus',
                    amount: referralBonus,
                    description: `Bônus de 10% pela compra do plano ${plan.name} do referido ${user.username}`,
                    relatedId: user._id
                });
            }
        }

        res.status(200).json({ message: 'Plano comprado e ativado com sucesso!', user });

    } catch (error) {
        console.error('Erro ao comprar plano:', error);
        res.status(500).json({ message: 'Erro do servidor ao comprar plano.' });
    }
};

// --- Video Controllers ---

// Adicionar novo vídeo (Admin)
const addVideo = async (req, res) => {
    const { title, description, url, duration } = req.body;

    if (!title || !url || !duration) {
        return res.status(400).json({ message: 'Título, URL e duração do vídeo são obrigatórios.' });
    }

    // Se for upload local via Multer, req.file existirá
    let videoUrl = url;
    if (req.file) {
        try {
            const result = await cloudinary.uploader.upload(req.file.path, {
                resource_type: "video",
                folder: "veed_videos"
            });
            videoUrl = result.secure_url;
            // Limpar o arquivo temporário do multer
            const fs = require('fs');
            fs.unlinkSync(req.file.path);
        } catch (uploadError) {
            console.error('Erro ao fazer upload do vídeo para Cloudinary:', uploadError);
            return res.status(500).json({ message: 'Erro ao fazer upload do vídeo para o Cloudinary.' });
        }
    }

    try {
        const newVideo = await Video.create({
            title,
            description,
            url: videoUrl,
            duration,
            uploadedBy: req.user._id // Quem está subindo o vídeo (admin)
        });
        res.status(201).json({ message: 'Vídeo adicionado com sucesso!', video: newVideo });
    } catch (error) {
        console.error('Erro ao adicionar vídeo:', error);
        res.status(500).json({ message: 'Erro do servidor ao adicionar vídeo.' });
    }
};

// Obter vídeos diários para o usuário
const getDailyVideos = async (req, res) => {
    const user = await User.findById(req.user._id).populate('currentPlan');

    if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado.' });
    }
    if (!user.currentPlan) {
        return res.status(400).json({ message: 'Você não tem um plano ativo. Por favor, compre um plano para assistir vídeos.' });
    }

    const today = getMaputoDate().startOf('day');
    const videosWatchedToday = user.videosWatchedTodayCount;
    const planVideosLimit = user.currentPlan.videosPerDay;

    // Verificar se a data do último claim de recompensa é diferente de hoje (significa que é um novo dia)
    const lastClaimDate = user.lastRewardClaimDate ? moment(user.lastRewardClaimDate).tz("Africa/Maputo").startOf('day') : null;

    if (!lastClaimDate || !lastClaimDate.isSame(today, 'day')) {
        // É um novo dia, reiniciar a contagem e redefinir vídeos a serem assistidos
        user.videosWatchedTodayCount = 0;
        // Opcional: Limpar o histórico de vídeos assistidos para a seleção diária para que eles possam ser selecionados novamente.
        // Se a regra é "não podem ser repetidos em outros dias DENTRO DO MESMO PLANO", precisamos de uma lógica mais sofisticada ou resetar aqui.
        // Por enquanto, vou considerar que a cada 0h, novos vídeos são selecionados.
        // Uma abordagem melhor para "não repetir no mesmo plano" seria usar `watchedVideosHistory` com um filtro de data.
        // Para a regra "não podem ser repetidos em outros dias dentro do mesmo plano", vamos garantir que a seleção não inclua os do history.
        // Mas a cada 0h, a lista de "vídeos que podem ser escolhidos" é renovada.
        // Para simplificar agora, a cada 0h, a seleção é "novos vídeos não assistidos hoje".
        // A lógica de "não repetir NUNCA dentro do plano" é mais complexa e envolveria resetar o history apenas na compra de um novo plano ou quando o plano termina.
        // Vamos manter o `watchedVideosHistory` acumulativo para evitar repetições globais enquanto o plano está ativo.
        await user.save();
    }


    if (videosWatchedToday >= planVideosLimit) {
        return res.status(200).json({ message: 'Você já assistiu a todos os seus vídeos diários. Volte amanhã para mais!', videos: [] });
    }

    try {
        // Obter IDs dos vídeos já assistidos pelo usuário (durante o período do plano atual)
        const watchedVideoIds = user.watchedVideosHistory
            .filter(entry => moment(entry.watchedOn).isSameOrAfter(moment(user.planActivationDate).startOf('day'))) // Apenas vídeos assistidos desde a ativação do plano
            .map(entry => entry.videoId);

        // Encontrar vídeos ativos que ainda não foram assistidos pelo usuário
        const availableVideos = await Video.find({
            _id: { $nin: watchedVideoIds }, // Excluir vídeos já assistidos
            isActive: true
        });

        // Embaralhar e selecionar `planVideosLimit` vídeos únicos
        const shuffledVideos = availableVideos.sort(() => 0.5 - Math.random());
        const videosForToday = shuffledVideos.slice(0, planVideosLimit - videosWatchedToday);

        if (videosForToday.length === 0 && videosWatchedToday < planVideosLimit) {
            return res.status(200).json({ message: 'No momento, não há novos vídeos disponíveis para você. Tente novamente mais tarde!', videos: [] });
        }

        res.status(200).json({
            message: `Aqui estão seus ${videosForToday.length} vídeos diários restantes.`,
            videos: videosForToday,
            videosRemainingToday: planVideosLimit - videosWatchedToday - videosForToday.length // Não deve ser negativo
        });

    } catch (error) {
        console.error('Erro ao obter vídeos diários:', error);
        res.status(500).json({ message: 'Erro do servidor ao obter vídeos diários.' });
    }
};

// Registrar vídeo como assistido e dar recompensa
const markVideoAsWatched = async (req, res) => {
    const userId = req.user._id;
    const { videoId } = req.body;

    if (!videoId) {
        return res.status(400).json({ message: 'ID do vídeo é obrigatório.' });
    }

    try {
        const user = await User.findById(userId).populate('currentPlan');
        const video = await Video.findById(videoId);

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        if (!video) {
            return res.status(404).json({ message: 'Vídeo não encontrado.' });
        }
        if (!user.currentPlan) {
            return res.status(400).json({ message: 'Você não tem um plano ativo.' });
        }

        const today = getMaputoDate().startOf('day');
        const lastClaimDate = user.lastRewardClaimDate ? moment(user.lastRewardClaimDate).tz("Africa/Maputo").startOf('day') : null;

        // Se é um novo dia, zerar a contagem e atualizar lastRewardClaimDate
        if (!lastClaimDate || !lastClaimDate.isSame(today, 'day')) {
            user.videosWatchedTodayCount = 0;
            user.lastRewardClaimDate = today.toDate(); // Atualiza a data do último claim
        }

        // Verificar se o usuário já assistiu a este vídeo hoje (ou durante o plano atual para evitar repetições no histórico)
        const alreadyWatchedToday = user.dailyVideosWatched.some(item =>
            item.videoId.toString() === videoId && moment(item.watchedAt).tz("Africa/Maputo").isSame(today, 'day')
        );

        const alreadyWatchedInPlan = user.watchedVideosHistory.some(item =>
            item.videoId.toString() === videoId && moment(item.watchedOn).isSameOrAfter(moment(user.planActivationDate).startOf('day'))
        );

        if (alreadyWatchedToday || alreadyWatchedInPlan) {
            return res.status(400).json({ message: 'Você já assistiu a este vídeo ou ele já foi contado para hoje.' });
        }

        if (user.videosWatchedTodayCount >= user.currentPlan.videosPerDay) {
            return res.status(400).json({ message: 'Você já assistiu o número máximo de vídeos permitidos pelo seu plano hoje.' });
        }

        // Adicionar vídeo ao histórico diário e geral
        user.dailyVideosWatched.push({ videoId, watchedAt: Date.now() });
        user.watchedVideosHistory.push({ videoId, watchedOn: Date.now() });
        user.videosWatchedTodayCount += 1;

        // Adicionar recompensa ao saldo do usuário
        const videoReward = user.currentPlan.dailyReward / user.currentPlan.videosPerDay;
        user.balance += videoReward;

        await user.save();

        // Registrar a transação da recompensa
        await Transaction.create({
            userId: user._id,
            type: 'video_reward',
            amount: videoReward,
            description: `Recompensa por assistir vídeo: ${video.title}`,
            relatedId: video._id
        });

        // Recompensa para o referenciador (5% da renda diária do indicado)
        if (user.referredBy) {
            const referrer = await User.findById(user.referredBy);
            if (referrer) {
                const referralDailyBonus = videoReward * 0.05; // 5% do que o referido ganha por este vídeo
                referrer.balance += referralDailyBonus;
                await referrer.save();

                await Transaction.create({
                    userId: referrer._id,
                    type: 'referral_daily_bonus',
                    amount: referralDailyBonus,
                    description: `Bônus de 5% da recompensa diária do referido ${user.username} pelo vídeo ${video.title}`,
                    relatedId: user._id
                });
            }
        }

        res.status(200).json({
            message: 'Vídeo assistido e recompensa creditada com sucesso!',
            newBalance: user.balance,
            videosWatchedToday: user.videosWatchedTodayCount
        });

    } catch (error) {
        console.error('Erro ao marcar vídeo como assistido:', error);
        res.status(500).json({ message: 'Erro do servidor ao marcar vídeo como assistido.' });
    }
};

// --- Deposit Controllers ---

// Solicitar depósito
const requestDeposit = async (req, res) => {
    const userId = req.user._id;
    const { amount, mpesaNumber, transactionId, proof } = req.body; // 'proof' pode ser texto ou URL de imagem

    if (!amount || !mpesaNumber || !proof) {
        return res.status(400).json({ message: 'Todos os campos de depósito são obrigatórios.' });
    }
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: 'O valor do depósito deve ser um número positivo.' });
    }

    try {
        const newDeposit = await Deposit.create({
            userId,
            amount,
            mpesaNumber,
            transactionId: transactionId || 'Não Informado',
            proof,
            status: 'pending'
        });

        res.status(201).json({ message: 'Depósito solicitado com sucesso! Aguardando aprovação.', deposit: newDeposit });
    } catch (error) {
        console.error('Erro ao solicitar depósito:', error);
        res.status(500).json({ message: 'Erro do servidor ao solicitar depósito.' });
    }
};

// Upload de comprovante de depósito (se for imagem)
const uploadDepositProof = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Por favor, envie um arquivo de imagem como comprovante.' });
    }

    try {
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'veed_proofs',
        });

        // Limpar o arquivo temporário do multer
        const fs = require('fs');
        fs.unlinkSync(req.file.path);

        res.status(200).json({
            message: 'Comprovante enviado com sucesso!',
            proofUrl: result.secure_url
        });
    } catch (error) {
        console.error('Erro ao fazer upload do comprovante:', error);
        res.status(500).json({ message: 'Erro ao fazer upload do comprovante.' });
    }
};

// Obter histórico de depósitos do usuário
const getUserDeposits = async (req, res) => {
    try {
        const deposits = await Deposit.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.status(200).json(deposits);
    } catch (error) {
        console.error('Erro ao obter depósitos do usuário:', error);
        res.status(500).json({ message: 'Erro do servidor ao obter depósitos.' });
    }
};

// Aprovar/Rejeitar depósito (Admin)
const updateDepositStatus = async (req, res) => {
    const { depositId } = req.params;
    const { status } = req.body; // 'approved' ou 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Status inválido. Deve ser "approved" ou "rejected".' });
    }

    try {
        const deposit = await Deposit.findById(depositId);
        if (!deposit) {
            return res.status(404).json({ message: 'Depósito não encontrado.' });
        }
        if (deposit.status !== 'pending') {
            return res.status(400).json({ message: `Este depósito já foi ${deposit.status}.` });
        }

        deposit.status = status;
        deposit.approvedBy = req.user._id; // Admin que aprovou
        deposit.approvedAt = Date.now();

        if (status === 'approved') {
            const user = await User.findById(deposit.userId);
            if (user) {
                user.balance += deposit.amount;
                await user.save();

                // Registrar a transação
                await Transaction.create({
                    userId: user._id,
                    type: 'deposit',
                    amount: deposit.amount,
                    description: `Depósito aprovado (Ref: ${deposit._id})`,
                    relatedId: deposit._id
                });
            } else {
                console.warn(`Usuário do depósito ${depositId} não encontrado.`);
            }
        }
        await deposit.save();
        res.status(200).json({ message: `Depósito ${status} com sucesso!`, deposit });
    } catch (error) {
        console.error('Erro ao atualizar status do depósito:', error);
        res.status(500).json({ message: 'Erro do servidor ao atualizar status do depósito.' });
    }
};


// --- Withdrawal Controllers ---

// Solicitar levantamento (Usuário)
const requestWithdrawal = async (req, res) => {
    const userId = req.user._id;
    const { amount, mpesaNumber } = req.body;

    if (!amount || !mpesaNumber) {
        return res.status(400).json({ message: 'Todos os campos de levantamento são obrigatórios.' });
    }
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: 'O valor do levantamento deve ser um número positivo.' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        if (user.balance < amount) {
            return res.status(400).json({ message: 'Saldo insuficiente para este levantamento.' });
        }

        // Criar a solicitação de levantamento
        const newWithdrawal = await Withdrawal.create({
            userId,
            amount,
            mpesaNumber,
            status: 'pending'
        });

        // Deduzir o valor do saldo do usuário imediatamente (ou após aprovação, dependendo da regra de negócio)
        // Por enquanto, vamos deduzir imediatamente, e o admin faz o envio manual
        user.balance -= amount;
        await user.save();

        // Registrar a transação
        await Transaction.create({
            userId: user._id,
            type: 'withdrawal',
            amount: -amount, // Negativo porque é uma saída
            description: `Solicitação de levantamento (Ref: ${newWithdrawal._id})`,
            relatedId: newWithdrawal._id
        });

        res.status(201).json({ message: 'Solicitação de levantamento enviada com sucesso! Aguardando aprovação e envio manual.', withdrawal: newWithdrawal });
    } catch (error) {
        console.error('Erro ao solicitar levantamento:', error);
        res.status(500).json({ message: 'Erro do servidor ao solicitar levantamento.' });
    }
};

// Obter histórico de levantamentos do usuário
const getUserWithdrawals = async (req, res) => {
    try {
        const withdrawals = await Withdrawal.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.status(200).json(withdrawals);
    } catch (error) {
        console.error('Erro ao obter levantamentos do usuário:', error);
        res.status(500).json({ message: 'Erro do servidor ao obter levantamentos.' });
    }
};

// Aprovar/Rejeitar levantamento (Admin)
const updateWithdrawalStatus = async (req, res) => {
    const { withdrawalId } = req.params;
    const { status } = req.body; // 'approved' ou 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Status inválido. Deve ser "approved" ou "rejected".' });
    }

    try {
        const withdrawal = await Withdrawal.findById(withdrawalId);
        if (!withdrawal) {
            return res.status(404).json({ message: 'Levantamento não encontrado.' });
        }
        if (withdrawal.status !== 'pending') {
            return res.status(400).json({ message: `Este levantamento já foi ${withdrawal.status}.` });
        }

        withdrawal.status = status;
        withdrawal.approvedBy = req.user._id; // Admin que aprovou
        withdrawal.approvedAt = Date.now();

        if (status === 'rejected') {
            // Se o levantamento for rejeitado, o valor deve ser devolvido ao saldo do usuário
            const user = await User.findById(withdrawal.userId);
            if (user) {
                user.balance += withdrawal.amount;
                await user.save();

                // Registrar a transação de estorno
                await Transaction.create({
                    userId: user._id,
                    type: 'manual_adjustment', // Ou 'withdrawal_reversal'
                    amount: withdrawal.amount,
                    description: `Estorno de levantamento rejeitado (Ref: ${withdrawal._id})`,
                    relatedId: withdrawal._id
                });
            } else {
                console.warn(`Usuário do levantamento ${withdrawalId} não encontrado para estorno.`);
            }
        }
        await withdrawal.save();
        res.status(200).json({ message: `Levantamento ${status} com sucesso!`, withdrawal });
    } catch (error) {
        console.error('Erro ao atualizar status do levantamento:', error);
        res.status(500).json({ message: 'Erro do servidor ao atualizar status do levantamento.' });
    }
};


// --- Admin Panel Controllers ---

// Obter lista de todos os usuários (Admin)
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).select('-password').populate('currentPlan', 'name');
        res.status(200).json(users);
    } catch (error) {
        console.error('Erro ao obter todos os usuários:', error);
        res.status(500).json({ message: 'Erro do servidor ao obter usuários.' });
    }
};

// Obter todos os depósitos (Admin)
const getAllDeposits = async (req, res) => {
    try {
        const deposits = await Deposit.find({}).populate('userId', 'username email').sort({ createdAt: -1 });
        res.status(200).json(deposits);
    } catch (error) {
        console.error('Erro ao obter todos os depósitos:', error);
        res.status(500).json({ message: 'Erro do servidor ao obter depósitos.' });
    }
};

// Obter todos os levantamentos (Admin)
const getAllWithdrawals = async (req, res) => {
    try {
        const withdrawals = await Withdrawal.find({}).populate('userId', 'username email').sort({ createdAt: -1 });
        res.status(200).json(withdrawals);
    } catch (error) {
        console.error('Erro ao obter todos os levantamentos:', error);
        res.status(500).json({ message: 'Erro do servidor ao obter levantamentos.' });
    }
};

// Bloquear/Desbloquear usuário (Admin)
const toggleUserActiveStatus = async (req, res) => {
    const { userId } = req.params;
    const { isActive } = req.body; // true para desbloquear, false para bloquear

    if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: 'O status isActive deve ser um booleano.' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        user.isActive = isActive;
        await user.save();

        res.status(200).json({ message: `Usuário ${isActive ? 'desbloqueado' : 'bloqueado'} com sucesso!`, user });
    } catch (error) {
        console.error('Erro ao mudar status do usuário:', error);
        res.status(500).json({ message: 'Erro do servidor ao mudar status do usuário.' });
    }
};

// Adicionar/Remover saldo manualmente (Admin)
const adjustUserBalance = async (req, res) => {
    const { userId } = req.params;
    const { amount, type, description } = req.body; // type: 'add' ou 'remove'

    if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Valor inválido. Deve ser um número positivo.' });
    }
    if (!['add', 'remove'].includes(type)) {
        return res.status(400).json({ message: 'Tipo de ajuste inválido. Deve ser "add" ou "remove".' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        let finalAmount = amount;
        let transactionDescription = `Ajuste manual de saldo (${type === 'add' ? 'Adição' : 'Remoção'}): ${description || 'N/A'}`;

        if (type === 'add') {
            user.balance += finalAmount;
        } else { // 'remove'
            user.balance -= finalAmount;
            finalAmount = -finalAmount; // Para registrar na transação como negativo
        }

        await user.save();

        // Registrar a transação
        await Transaction.create({
            userId: user._id,
            type: 'manual_adjustment',
            amount: finalAmount,
            description: transactionDescription,
            relatedId: req.user._id // Quem fez o ajuste (admin)
        });

        res.status(200).json({ message: `Saldo do usuário ajustado com sucesso! Novo saldo: ${user.balance}`, user });
    } catch (error) {
        console.error('Erro ao ajustar saldo do usuário:', error);
        res.status(500).json({ message: 'Erro do servidor ao ajustar saldo.' });
    }
};

// Obter lista de todos os vídeos (Admin)
const getAllVideos = async (req, res) => {
    try {
        const videos = await Video.find({});
        res.status(200).json(videos);
    } catch (error) {
        console.error('Erro ao obter vídeos:', error);
        res.status(500).json({ message: 'Erro do servidor ao obter vídeos.' });
    }
};

// Excluir vídeo (Admin)
const deleteVideo = async (req, res) => {
    const { videoId } = req.params;
    try {
        const video = await Video.findByIdAndDelete(videoId);
        if (!video) {
            return res.status(404).json({ message: 'Vídeo não encontrado.' });
        }
        res.status(200).json({ message: 'Vídeo excluído com sucesso!' });
    } catch (error) {
        console.error('Erro ao excluir vídeo:', error);
        res.status(500).json({ message: 'Erro do servidor ao excluir vídeo.' });
    }
};

// Obter todas as transações (Admin)
const getAllTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.find({})
            .populate('userId', 'username email')
            .sort({ createdAt: -1 });
        res.status(200).json(transactions);
    } catch (error) {
        console.error('Erro ao obter transações:', error);
        res.status(500).json({ message: 'Erro do servidor ao obter transações.' });
    }
};

// Obter transações de um usuário específico (Admin)
const getUserTransactions = async (req, res) => {
    const { userId } = req.params;
    try {
        const transactions = await Transaction.find({ userId })
            .sort({ createdAt: -1 });
        res.status(200).json(transactions);
    } catch (error) {
        console.error('Erro ao obter transações do usuário:', error);
        res.status(500).json({ message: 'Erro do servidor ao obter transações do usuário.' });
    }
};


// Obter saldo M-Pesa/e-Mola do admin (da AdminSettings)
const getAdminMpesaNumber = async (req, res) => {
    try {
        const setting = await AdminSettings.findOne({ settingName: 'mpesaNumber' });
        if (!setting) {
            return res.status(404).json({ message: 'Número M-Pesa do admin não configurado.' });
        }
        res.status(200).json({ mpesaNumber: setting.settingValue });
    } catch (error) {
        console.error('Erro ao obter número M-Pesa do admin:', error);
        res.status(500).json({ message: 'Erro do servidor ao obter número M-Pesa do admin.' });
    }
};

// Configurar/Atualizar saldo M-Pesa/e-Mola do admin (Admin)
const setAdminMpesaNumber = async (req, res) => {
    const { mpesaNumber } = req.body;
    if (!mpesaNumber) {
        return res.status(400).json({ message: 'Número M-Pesa é obrigatório.' });
    }

    try {
        const setting = await AdminSettings.findOneAndUpdate(
            { settingName: 'mpesaNumber' },
            { settingValue: mpesaNumber, description: 'Número M-Pesa/e-Mola para depósitos de usuários.' },
            { upsert: true, new: true } // upsert: cria se não existir, new: retorna o documento atualizado
        );
        res.status(200).json({ message: 'Número M-Pesa do admin configurado/atualizado com sucesso!', setting });
    } catch (error) {
        console.error('Erro ao configurar número M-Pesa do admin:', error);
        res.status(500).json({ message: 'Erro do servidor ao configurar número M-Pesa do admin.' });
    }
};


module.exports = {
    protect,
    admin,
    registerUser,
    loginUser,
    getUserProfile,
    updateUserProfile,
    uploadUserAvatar,
    forgotPassword,
    resetPassword,
    createPlan,
    getAllPlans,
    purchasePlan,
    addVideo,
    getDailyVideos,
    markVideoAsWatched,
    requestDeposit,
    uploadDepositProof,
    getUserDeposits,
    updateDepositStatus,
    requestWithdrawal,
    getUserWithdrawals,
    updateWithdrawalStatus,
    getAllUsers,
    getAllDeposits,
    getAllWithdrawals,
    toggleUserActiveStatus,
    adjustUserBalance,
    getAllVideos,
    deleteVideo,
    getAllTransactions,
    getUserTransactions,
    getAdminMpesaNumber,
    setAdminMpesaNumber
};