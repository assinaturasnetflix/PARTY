// controllers.js
const cloudinary = require('cloudinary').v2; // Importa o Cloudinary diretamente aqui
const { User, Plan, Video, Deposit, Withdrawal, Transaction } = require('./models');
const { generateToken, sendPasswordResetEmail, sendWelcomeEmail, isNewDayForReward } = require('./utils');
const { bcrypt, moment } = require('./server'); // Remove 'cloudinary' daqui


// --- Funções de Autenticação e Usuário ---

// Cadastro de Usuário
async function registerUser(req, res) {
    const { username, email, password, referralCode } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }

    try {
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(409).json({ message: 'Nome de usuário ou e-mail já registrado.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        let referredByUserId = null;

        if (referralCode) {
            const referrer = await User.findOne({ referralCode });
            if (referrer) {
                referredByUserId = referrer._id;
            } else {
                return res.status(400).json({ message: 'Código de referência inválido.' });
            }
        }

        const newUser = new User({
            username,
            email,
            password: hashedPassword,
            referralCode: generateReferralCode(), // Gera um código único
            referredBy: referredByUserId
        });

        await newUser.save();
        await sendWelcomeEmail(newUser.email, newUser.username); // Envia email de boas-vindas

        // Adiciona a transação de bônus de cadastro
        const bonusTransaction = new Transaction({
            userId: newUser._id,
            type: 'Sign-up Bonus',
            amount: 50,
            status: 'Completed',
            description: 'Bônus de cadastro'
        });
        await bonusTransaction.save();


        res.status(201).json({ message: 'Usuário registrado com sucesso!', userId: newUser._id });
    } catch (error) {
        console.error('Erro no registro de usuário:', error);
        res.status(500).json({ message: 'Erro no servidor ao registrar usuário.', error: error.message });
    }
}

// Login de Usuário
async function loginUser(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Credenciais inválidas.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Credenciais inválidas.' });
        }

        if (!user.isActive) {
            return res.status(403).json({ message: 'Sua conta foi bloqueada. Entre em contato com o suporte.' });
        }

        const token = generateToken(user._id);
        res.status(200).json({ message: 'Login bem-sucedido!', token, userId: user._id, isAdmin: user.isAdmin });
    } catch (error) {
        console.error('Erro no login de usuário:', error);
        res.status(500).json({ message: 'Erro no servidor ao fazer login.', error: error.message });
    }
}

// Solicitar Redefinição de Senha
async function requestPasswordReset(req, res) {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado com este e-mail.' });
        }

        const token = generateToken(user._id); // Reutiliza a função de token JWT para o reset
        // Em um sistema real, este token teria uma expiração menor e seria armazenado no BD junto com o usuário para validação.
        // Por simplicidade, estamos usando o token JWT existente.

        const emailSent = await sendPasswordResetEmail(email, token);
        if (emailSent) {
            res.status(200).json({ message: 'Link de recuperação de senha enviado para o seu e-mail.' });
        } else {
            res.status(500).json({ message: 'Falha ao enviar e-mail de recuperação de senha.' });
        }
    } catch (error) {
        console.error('Erro ao solicitar redefinição de senha:', error);
        res.status(500).json({ message: 'Erro no servidor ao solicitar redefinição de senha.', error: error.message });
    }
}

// Redefinir Senha (com validação de token)
async function resetPassword(req, res) {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token e nova senha são obrigatórios.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ message: 'Senha redefinida com sucesso!' });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expirado. Por favor, solicite um novo link de redefinição.' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({ message: 'Token inválido.' });
        }
        console.error('Erro ao redefinir senha:', error);
        res.status(500).json({ message: 'Erro no servidor ao redefinir senha.', error: error.message });
    }
}

// Obter Perfil do Usuário
async function getUserProfile(req, res) {
    try {
        const user = await User.findById(req.userId)
            .select('-password') // Não retorna a senha
            .populate('currentPlan', 'name videosPerDay dailyReward'); // Popula informações do plano

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error('Erro ao obter perfil do usuário:', error);
        res.status(500).json({ message: 'Erro no servidor ao obter perfil.', error: error.message });
    }
}

// Atualizar Perfil do Usuário (apenas e-mail por enquanto)
async function updateProfile(req, res) {
    const { email } = req.body; // Adicionar mais campos conforme necessário

    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        if (email && email !== user.email) {
            const emailExists = await User.findOne({ email });
            if (emailExists && emailExists._id.toString() !== user._id.toString()) {
                return res.status(409).json({ message: 'Este e-mail já está em uso por outro usuário.' });
            }
            user.email = email;
        }

        await user.save();
        res.status(200).json({ message: 'Perfil atualizado com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        res.status(500).json({ message: 'Erro no servidor ao atualizar perfil.', error: error.message });
    }
}

// Alterar Senha
async function changePassword(req, res) {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        return res.status(400).json({ message: 'Senha antiga e nova senha são obrigatórias.' });
    }

    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Senha antiga incorreta.' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.status(200).json({ message: 'Senha alterada com sucesso!' });
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        res.status(500).json({ message: 'Erro no servidor ao alterar senha.', error: error.message });
    }
}

// Upload de Avatar
async function uploadAvatar(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        // Fazer upload da imagem para o Cloudinary
        const result = await cloudinary.uploader.upload(req.file.buffer.toString('base64'), {
            folder: 'veed_avatars',
            resource_type: 'image'
        });

        // Atualizar o URL do avatar do usuário
        user.avatar = result.secure_url;
        await user.save();

        res.status(200).json({ message: 'Avatar atualizado com sucesso!', avatarUrl: result.secure_url });
    } catch (error) {
        console.error('Erro ao fazer upload do avatar:', error);
        res.status(500).json({ message: 'Erro no servidor ao fazer upload do avatar.', error: error.message });
    }
}

// --- Funções de Planos ---

// Criar Plano (Admin)
async function createPlan(req, res) {
    const { name, value, videosPerDay, durationDays } = req.body;

    if (!name || !value || !videosPerDay || !durationDays) {
        return res.status(400).json({ message: 'Todos os campos do plano são obrigatórios.' });
    }

    try {
        const existingPlan = await Plan.findOne({ name });
        if (existingPlan) {
            return res.status(409).json({ message: 'Um plano com este nome já existe.' });
        }

        // Calcular recompensa diária e total (Exemplo: 30MT/dia * 30 dias = 900MT total)
        // A recompensa diária é a recompensa total dividida pela duração
        const totalReturn = value * 3; // Exemplo de retorno total, pode ser uma fórmula diferente
        const dailyReward = totalReturn / durationDays;


        const newPlan = new Plan({
            name,
            value,
            videosPerDay,
            durationDays,
            dailyReward,
            totalReturn
        });

        await newPlan.save();
        res.status(201).json({ message: 'Plano criado com sucesso!', plan: newPlan });
    } catch (error) {
        console.error('Erro ao criar plano:', error);
        res.status(500).json({ message: 'Erro no servidor ao criar plano.', error: error.message });
    }
}

// Listar Planos
async function listPlans(req, res) {
    try {
        const plans = await Plan.find({});
        res.status(200).json(plans);
    } catch (error) {
        console.error('Erro ao listar planos:', error);
        res.status(500).json({ message: 'Erro no servidor ao listar planos.', error: error.message });
    }
}

// Comprar Plano
async function purchasePlan(req, res) {
    const { planId } = req.body;

    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        const plan = await Plan.findById(planId);
        if (!plan) {
            return res.status(404).json({ message: 'Plano não encontrado.' });
        }

        if (user.balance < plan.value) {
            return res.status(400).json({ message: 'Saldo insuficiente para comprar este plano.' });
        }

        if (user.currentPlan && user.planExpiresAt && moment().isBefore(user.planExpiresAt)) {
            return res.status(400).json({ message: 'Você já tem um plano ativo. Aguarde o término ou atualize-o.' });
        }

        user.balance -= plan.value;
        user.currentPlan = plan._id;
        user.planExpiresAt = moment().add(plan.durationDays, 'days').toDate();
        user.videosWatchedToday = []; // Reseta os vídeos assistidos ao ativar um novo plano
        user.dailyRewardClaimedAt = null; // Reseta o controle de recompensa diária

        await user.save();

        // Registrar transação de compra de plano
        const planPurchaseTransaction = new Transaction({
            userId: user._id,
            type: 'Plan Purchase',
            amount: -plan.value, // Valor negativo para saída de dinheiro
            status: 'Completed',
            relatedTo: plan._id,
            relatedModel: 'Plan',
            description: `Compra do plano ${plan.name}`
        });
        await planPurchaseTransaction.save();

        // Lógica para bônus de referência (10% do valor do plano para o referenciador)
        if (user.referredBy) {
            const referrer = await User.findById(user.referredBy);
            if (referrer) {
                const bonusAmount = plan.value * 0.10;
                referrer.balance += bonusAmount;
                await referrer.save();

                // Registrar transação de bônus de referência para o referenciador
                const referralBonusTransaction = new Transaction({
                    userId: referrer._id,
                    type: 'Referral Bonus',
                    amount: bonusAmount,
                    status: 'Completed',
                    description: `Bônus de 10% pela compra de plano do ${user.username}`
                });
                await referralBonusTransaction.save();
            }
        }

        res.status(200).json({ message: 'Plano comprado e ativado com sucesso!', newBalance: user.balance, plan: plan.name });
    } catch (error) {
        console.error('Erro ao comprar plano:', error);
        res.status(500).json({ message: 'Erro no servidor ao comprar plano.', error: error.message });
    }
}

// --- Funções de Vídeos ---

// Adicionar Vídeo (Admin)
async function addVideo(req, res) {
    const { title, url, description } = req.body;

    if (!title || !url) {
        return res.status(400).json({ message: 'Título e URL do vídeo são obrigatórios.' });
    }

    try {
        let videoUrl = url;
        // Se houver um arquivo e não for uma URL externa (poderia ser feito upload local via Multer para Cloudinary)
        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.buffer.toString('base64'), {
                resource_type: 'video',
                folder: 'veed_videos'
            });
            videoUrl = result.secure_url;
        }

        const newVideo = new Video({
            title,
            url: videoUrl,
            description
        });

        await newVideo.save();
        res.status(201).json({ message: 'Vídeo adicionado com sucesso!', video: newVideo });
    } catch (error) {
        console.error('Erro ao adicionar vídeo:', error);
        res.status(500).json({ message: 'Erro no servidor ao adicionar vídeo.', error: error.message });
    }
}

// Listar Vídeos Disponíveis (Admin)
async function listAllVideos(req, res) {
    try {
        const videos = await Video.find({});
        res.status(200).json(videos);
    } catch (error) {
        console.error('Erro ao listar todos os vídeos:', error);
        res.status(500).json({ message: 'Erro no servidor ao listar vídeos.', error: error.message });
    }
}

// Obter Vídeos do Dia para o Usuário
async function getDailyVideos(req, res) {
    try {
        const user = await User.findById(req.userId).populate('currentPlan');
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        if (!user.currentPlan || !user.planExpiresAt || moment().isAfter(user.planExpiresAt)) {
            return res.status(400).json({ message: 'Você não tem um plano ativo ou seu plano expirou. Por favor, compre um plano.' });
        }

        const videosPerDay = user.currentPlan.videosPerDay;

        // Resetar vídeos assistidos e permitir novas recompensas se for um novo dia em Maputo
        if (isNewDayForReward(user.dailyRewardClaimedAt)) {
            user.videosWatchedToday = [];
            user.dailyRewardClaimedAt = null; // Reseta para que a recompensa só seja dada após assistir os vídeos
            await user.save();
        }

        const watchedVideoIdsToday = user.videosWatchedToday.map(v => v.videoId);

        // Encontrar vídeos que não foram assistidos pelo usuário ATÉ HOJE
        const availableVideos = await Video.find({
            _id: { $nin: watchedVideoIdsToday }, // Exclui vídeos já assistidos hoje
            isAvailable: true // Apenas vídeos ativos
        });

        // Filtrar vídeos que já foram assistidos em dias anteriores dentro do plano ativo
        // Este é um desafio complexo sem um campo de "histórico total" por vídeo e plano.
        // Por simplicidade, vamos garantir que os vídeos assistidos hoje não se repitam nos próximos dias.
        // Uma solução mais robusta exigiria um array de `allWatchedVideos` no User ou um modelo `WatchedVideoHistory`.

        let videosForToday = [];
        // Selecionar aleatoriamente `videosPerDay` vídeos únicos dos disponíveis
        if (availableVideos.length <= videosPerDay) {
            videosForToday = availableVideos; // Se não houver vídeos suficientes, retorna todos
        } else {
            const shuffled = availableVideos.sort(() => 0.5 - Math.random());
            videosForToday = shuffled.slice(0, videosPerDay);
        }

        if (videosForToday.length === 0 && user.videosWatchedToday.length < videosPerDay) {
            return res.status(200).json({ message: 'Nenhum vídeo novo disponível no momento. Volte amanhã!', videos: [] });
        }
        
        // Se o usuário já assistiu todos os vídeos do dia (e a lista está completa), ele não deve ver mais vídeos.
        if (user.videosWatchedToday.length >= videosPerDay) {
            return res.status(200).json({ message: 'Você já assistiu todos os seus vídeos hoje. Volte amanhã para mais!', videos: [] });
        }


        res.status(200).json({
            message: `Aqui estão seus ${videosForToday.length} vídeos para hoje. Assista para ganhar!`,
            videos: videosForToday,
            videosRemaining: videosPerDay - user.videosWatchedToday.length,
            currentDailyReward: user.currentPlan.dailyReward // Recompensa por vídeo assistido
        });

    } catch (error) {
        console.error('Erro ao obter vídeos do dia:', error);
        res.status(500).json({ message: 'Erro no servidor ao obter vídeos do dia.', error: error.message });
    }
}

// Marcar Vídeo como Assistido e Distribuir Recompensa
async function markVideoAsWatched(req, res) {
    const { videoId } = req.body;

    try {
        const user = await User.findById(req.userId).populate('currentPlan');
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        if (!user.currentPlan || !user.planExpiresAt || moment().isAfter(user.planExpiresAt)) {
            return res.status(400).json({ message: 'Você não tem um plano ativo ou seu plano expirou. Por favor, compre um plano.' });
        }

        const video = await Video.findById(videoId);
        if (!video) {
            return res.status(404).json({ message: 'Vídeo não encontrado.' });
        }

        const videosPerDay = user.currentPlan.videosPerDay;
        const dailyRewardPerVideo = user.currentPlan.dailyReward / videosPerDay; // Recompensa por video individual

        // Verifica se o vídeo já foi assistido hoje
        const alreadyWatchedToday = user.videosWatchedToday.some(v => v.videoId.equals(videoId));
        if (alreadyWatchedToday) {
            return res.status(400).json({ message: 'Você já assistiu este vídeo hoje. Por favor, selecione outro.' });
        }

        // Verifica se o usuário já assistiu o número máximo de vídeos hoje
        if (user.videosWatchedToday.length >= videosPerDay) {
            return res.status(400).json({ message: 'Você já assistiu todos os vídeos permitidos para hoje. Volte amanhã!' });
        }

        // Adicionar vídeo ao histórico de vídeos assistidos hoje
        user.videosWatchedToday.push({ videoId: video._id, watchedAt: new Date() });
        user.balance += dailyRewardPerVideo; // Adiciona recompensa ao saldo

        // Verifica se todos os vídeos do dia foram assistidos para marcar a recompensa diária como "reclamada"
        if (user.videosWatchedToday.length >= videosPerDay) {
            user.dailyRewardClaimedAt = moment().tz('Africa/Maputo').startOf('day').toDate();
        }

        await user.save();

        // Registrar transação de recompensa diária por vídeo
        const rewardTransaction = new Transaction({
            userId: user._id,
            type: 'Daily Reward',
            amount: dailyRewardPerVideo,
            status: 'Completed',
            description: `Recompensa por assistir ao vídeo "${video.title}"`
        });
        await rewardTransaction.save();

        res.status(200).json({
            message: 'Vídeo marcado como assistido e recompensa creditada!',
            newBalance: user.balance,
            videosWatchedTodayCount: user.videosWatchedToday.length
        });
    } catch (error) {
        console.error('Erro ao marcar vídeo como assistido:', error);
        res.status(500).json({ message: 'Erro no servidor ao marcar vídeo como assistido.', error: error.message });
    }
}


// --- Funções de Depósito ---

// Solicitar Depósito (Usuário)
async function requestDeposit(req, res) {
    const { amount, method, proof } = req.body; // 'proof' pode ser URL da imagem ou texto de transação

    if (!amount || !method || !proof) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios para o depósito.' });
    }
    if (amount <= 0) {
        return res.status(400).json({ message: 'O valor do depósito deve ser positivo.' });
    }

    try {
        const newDeposit = new Deposit({
            userId: req.userId,
            amount,
            method,
            proof,
            status: 'Pending'
        });

        await newDeposit.save();

        // Registrar transação como pendente
        const depositTransaction = new Transaction({
            userId: req.userId,
            type: 'Deposit',
            amount: amount,
            status: 'Pending',
            relatedTo: newDeposit._id,
            relatedModel: 'Deposit',
            description: `Depósito pendente via ${method}`
        });
        await depositTransaction.save();

        res.status(201).json({ message: 'Solicitação de depósito enviada com sucesso! Aguardando aprovação do administrador.' });
    } catch (error) {
        console.error('Erro ao solicitar depósito:', error);
        res.status(500).json({ message: 'Erro no servidor ao solicitar depósito.', error: error.message });
    }
}

// Listar Depósitos Pendentes (Admin)
async function listPendingDeposits(req, res) {
    try {
        const pendingDeposits = await Deposit.find({ status: 'Pending' }).populate('userId', 'username email');
        res.status(200).json(pendingDeposits);
    } catch (error) {
        console.error('Erro ao listar depósitos pendentes:', error);
        res.status(500).json({ message: 'Erro no servidor ao listar depósitos pendentes.', error: error.message });
    }
}

// Aprovar/Rejeitar Depósito (Admin)
async function updateDepositStatus(req, res) {
    const { depositId } = req.params;
    const { status } = req.body; // 'Approved' ou 'Rejected'

    if (!['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ message: 'Status inválido. Use "Approved" ou "Rejected".' });
    }

    try {
        const deposit = await Deposit.findById(depositId);
        if (!deposit) {
            return res.status(404).json({ message: 'Depósito não encontrado.' });
        }
        if (deposit.status !== 'Pending') {
            return res.status(400).json({ message: `Depósito já foi ${deposit.status.toLowerCase()}.` });
        }

        deposit.status = status;
        deposit.approvedBy = req.userId; // ID do admin
        deposit.approvedAt = new Date();
        await deposit.save();

        // Atualiza a transação relacionada
        const transaction = await Transaction.findOne({ relatedTo: deposit._id });

        if (status === 'Approved') {
            const user = await User.findById(deposit.userId);
            if (user) {
                user.balance += deposit.amount;
                await user.save();
                if (transaction) {
                    transaction.status = 'Completed';
                    transaction.description = `Depósito aprovado via ${deposit.method}`;
                    await transaction.save();
                }
            }
        } else { // Rejected
            if (transaction) {
                transaction.status = 'Failed';
                transaction.description = `Depósito rejeitado via ${deposit.method}`;
                await transaction.save();
            }
        }

        res.status(200).json({ message: `Depósito ${status.toLowerCase()} com sucesso!`, deposit });
    } catch (error) {
        console.error('Erro ao atualizar status do depósito:', error);
        res.status(500).json({ message: 'Erro no servidor ao atualizar status do depósito.', error: error.message });
    }
}

// --- Funções de Levantamento (Saque) ---

// Solicitar Levantamento (Usuário)
async function requestWithdrawal(req, res) {
    const { amount, method, accountNumber } = req.body;

    if (!amount || !method || !accountNumber) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios para o levantamento.' });
    }
    if (amount <= 0) {
        return res.status(400).json({ message: 'O valor do levantamento deve ser positivo.' });
    }

    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        // Bônus de cadastro só pode ser sacado com plano ativo
        if (user.balance >= 50 && user.currentPlan === null) {
            return res.status(400).json({ message: 'O bônus de cadastro de 50MT só pode ser sacado após a compra de um plano ativo.' });
        }
        // Verificar se o valor solicitado é menor ou igual ao saldo disponível
        if (user.balance < amount) {
            return res.status(400).json({ message: 'Saldo insuficiente para este levantamento.' });
        }

        // Subtrai o valor do saque do saldo do usuário imediatamente
        user.balance -= amount;
        await user.save();

        const newWithdrawal = new Withdrawal({
            userId: req.userId,
            amount,
            method,
            accountNumber,
            status: 'Pending'
        });

        await newWithdrawal.save();

        // Registrar transação de levantamento como pendente
        const withdrawalTransaction = new Transaction({
            userId: req.userId,
            type: 'Withdrawal',
            amount: -amount, // Valor negativo para saída de dinheiro
            status: 'Pending',
            relatedTo: newWithdrawal._id,
            relatedModel: 'Withdrawal',
            description: `Levantamento pendente via ${method} para ${accountNumber}`
        });
        await withdrawalTransaction.save();

        res.status(201).json({ message: 'Solicitação de levantamento enviada com sucesso! Aguardando aprovação do administrador.', newBalance: user.balance });
    } catch (error) {
        console.error('Erro ao solicitar levantamento:', error);
        res.status(500).json({ message: 'Erro no servidor ao solicitar levantamento.', error: error.message });
    }
}

// Listar Levantamentos Pendentes (Admin)
async function listPendingWithdrawals(req, res) {
    try {
        const pendingWithdrawals = await Withdrawal.find({ status: 'Pending' }).populate('userId', 'username email');
        res.status(200).json(pendingWithdrawals);
    } catch (error) {
        console.error('Erro ao listar levantamentos pendentes:', error);
        res.status(500).json({ message: 'Erro no servidor ao listar levantamentos pendentes.', error: error.message });
    }
}

// Aprovar/Rejeitar Levantamento (Admin)
async function updateWithdrawalStatus(req, res) {
    const { withdrawalId } = req.params;
    const { status } = req.body; // 'Approved' ou 'Rejected'

    if (!['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ message: 'Status inválido. Use "Approved" ou "Rejected".' });
    }

    try {
        const withdrawal = await Withdrawal.findById(withdrawalId);
        if (!withdrawal) {
            return res.status(404).json({ message: 'Levantamento não encontrado.' });
        }
        if (withdrawal.status !== 'Pending') {
            return res.status(400).json({ message: `Levantamento já foi ${withdrawal.status.toLowerCase()}.` });
        }

        withdrawal.status = status;
        withdrawal.processedBy = req.userId; // ID do admin
        withdrawal.processedAt = new Date();
        await withdrawal.save();

        // Atualiza a transação relacionada
        const transaction = await Transaction.findOne({ relatedTo: withdrawal._id });

        if (status === 'Rejected') {
            // Se rejeitado, devolve o dinheiro para o saldo do usuário
            const user = await User.findById(withdrawal.userId);
            if (user) {
                user.balance += withdrawal.amount;
                await user.save();
            }
            if (transaction) {
                transaction.status = 'Failed';
                transaction.description = `Levantamento rejeitado. Valor devolvido.`;
                await transaction.save();
            }
        } else { // Approved
            if (transaction) {
                transaction.status = 'Completed';
                transaction.description = `Levantamento aprovado via ${withdrawal.method} para ${withdrawal.accountNumber}`;
                await transaction.save();
            }
        }

        res.status(200).json({ message: `Levantamento ${status.toLowerCase()} com sucesso!`, withdrawal });
    } catch (error) {
        console.error('Erro ao atualizar status do levantamento:', error);
        res.status(500).json({ message: 'Erro no servidor ao atualizar status do levantamento.', error: error.message });
    }
}

// --- Funções de Referência ---

// Obter Dados de Referência do Usuário
async function getUserReferrals(req, res) {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        // Encontrar usuários referidos por este usuário
        const referredUsers = await User.find({ referredBy: user._id }).select('username currentPlan balance');

        // Calcular ganhos de referência (exemplo: soma dos bônus de plano e renda diária dos referidos)
        let totalReferralEarnings = 0;
        for (const referred of referredUsers) {
            // Poderia buscar transações de 'Referral Bonus' para um cálculo mais preciso
            const referredTransactions = await Transaction.find({
                userId: referred._id,
                type: { $in: ['Plan Purchase', 'Daily Reward'] },
                status: 'Completed'
            });

            for (const trans of referredTransactions) {
                if (trans.type === 'Plan Purchase') {
                    // Ganho de 10% do valor do plano (se aplicável ao momento da compra)
                    const plan = await Plan.findById(trans.relatedTo);
                    if (plan) {
                        totalReferralEarnings += plan.value * 0.10;
                    }
                } else if (trans.type === 'Daily Reward') {
                    // Ganho de 5% da renda diária do indicado
                    totalReferralEarnings += trans.amount * 0.05;
                }
            }
        }


        res.status(200).json({
            referralCode: user.referralCode,
            referredUsers: referredUsers.map(r => ({
                username: r.username,
                currentPlan: r.currentPlan ? r.currentPlan.name : 'Nenhum',
                balance: r.balance
            })),
            totalReferralEarnings: totalReferralEarnings // Precisa ser mais preciso
        });

    } catch (error) {
        console.error('Erro ao obter dados de referência:', error);
        res.status(500).json({ message: 'Erro no servidor ao obter dados de referência.', error: error.message });
    }
}

// --- Funções de Admin (Painel) ---

// Listar Todos os Usuários (Admin)
async function listAllUsers(req, res) {
    try {
        const users = await User.find({}).select('-password').populate('currentPlan', 'name');
        res.status(200).json(users);
    } catch (error) {
        console.error('Erro ao listar todos os usuários:', error);
        res.status(500).json({ message: 'Erro no servidor ao listar usuários.', error: error.message });
    }
}

// Bloquear/Desbloquear Usuário (Admin)
async function toggleUserActiveStatus(req, res) {
    const { userId } = req.params;
    const { isActive } = req.body; // true para desbloquear, false para bloquear

    if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: 'Status de ativação inválido.' });
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
        console.error('Erro ao bloquear/desbloquear usuário:', error);
        res.status(500).json({ message: 'Erro no servidor ao bloquear/desbloquear usuário.', error: error.message });
    }
}

// Adicionar/Remover Saldo Manualmente (Admin)
async function adjustUserBalance(req, res) {
    const { userId } = req.params;
    const { amount, operation, description } = req.body; // operation: 'add' ou 'subtract'

    if (!amount || amount <= 0 || !operation || !['add', 'subtract'].includes(operation)) {
        return res.status(400).json({ message: 'Valor e operação válidos são obrigatórios.' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        let finalAmount = amount;
        let transactionType = 'Admin Adjustment';

        if (operation === 'add') {
            user.balance += amount;
            transactionType = 'Admin Add Balance';
        } else if (operation === 'subtract') {
            if (user.balance < amount) {
                return res.status(400).json({ message: 'Saldo insuficiente para remover este valor.' });
            }
            user.balance -= amount;
            finalAmount = -amount; // Para registrar na transação como negativo
            transactionType = 'Admin Subtract Balance';
        }
        await user.save();

        // Registrar transação de ajuste manual
        const adjustmentTransaction = new Transaction({
            userId: user._id,
            type: transactionType,
            amount: finalAmount,
            status: 'Completed',
            description: description || `Ajuste manual de saldo pelo admin.`
        });
        await adjustmentTransaction.save();

        res.status(200).json({ message: `Saldo do usuário ${operation === 'add' ? 'adicionado' : 'removido'} com sucesso!`, newBalance: user.balance });
    } catch (error) {
        console.error('Erro ao ajustar saldo do usuário:', error);
        res.status(500).json({ message: 'Erro no servidor ao ajustar saldo.', error: error.message });
    }
}

// Listar todas as transações (Admin)
async function getAllTransactions(req, res) {
    try {
        const transactions = await Transaction.find({})
            .populate('userId', 'username email')
            .sort({ createdAt: -1 }); // Mais recentes primeiro
        res.status(200).json(transactions);
    } catch (error) {
        console.error('Erro ao listar todas as transações:', error);
        res.status(500).json({ message: 'Erro no servidor ao listar transações.', error: error.message });
    }
}

// --- Funções de Carteira e Histórico ---

// Obter Histórico de Transações do Usuário
async function getUserTransactions(req, res) {
    try {
        const transactions = await Transaction.find({ userId: req.userId })
            .sort({ createdAt: -1 }); // Mais recentes primeiro
        res.status(200).json(transactions);
    } catch (error) {
        console.error('Erro ao obter histórico de transações:', error);
        res.status(500).json({ message: 'Erro no servidor ao obter histórico de transações.', error: error.message });
    }
}

// Gerar Código de Referência (Função auxiliar interna)
function generateReferralCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase(); // Gera um código alfanumérico curto
}


module.exports = {
    registerUser,
    loginUser,
    requestPasswordReset,
    resetPassword,
    getUserProfile,
    updateProfile,
    changePassword,
    uploadAvatar,
    createPlan,
    listPlans,
    purchasePlan,
    addVideo,
    listAllVideos,
    getDailyVideos,
    markVideoAsWatched,
    requestDeposit,
    listPendingDeposits,
    updateDepositStatus,
    requestWithdrawal,
    listPendingWithdrawals,
    updateWithdrawalStatus,
    getUserReferrals,
    listAllUsers,
    toggleUserActiveStatus,
    adjustUserBalance,
    getAllTransactions,
    getUserTransactions
};