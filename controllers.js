// controllers.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid'); // Para gerar códigos de referência únicos
const moment = require('moment-timezone'); // Para lidar com fusos horários e datas
const cloudinary = require('cloudinary').v2; // Para upload de arquivos
const {
  User,
  Plan,
  Video,
  Deposit,
  Withdrawal,
  Transaction,
  UserVideoHistory
} = require('./models'); // Importa todos os modelos
const { sendEmail } = require('./utils'); // Funções utilitárias, incluindo envio de email
const { generateReferralCode } = require('./utils'); // Importa a função de gerar código de referência
const { uploadToCloudinary } = require('./utils'); // Importa a função de upload para Cloudinary


// Configuração do Cloudinary (para uso direto em algumas funções, embora o middleware trate a maioria)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Obter as credenciais do JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('Erro: JWT_SECRET não definido no arquivo .env');
  process.exit(1); // Encerra a aplicação se a chave secreta não estiver definida
}


// --- Funções de Autenticação e Usuário ---

/**
 * @desc Registra um novo usuário na plataforma.
 * @route POST /register
 * @access Public
 */
exports.registerUser = async (req, res) => {
  const {
    username,
    email,
    password
  } = req.body;

  try {
    // Verificar se o usuário já existe
    let user = await User.findOne({
      email
    });
    if (user) {
      return res.status(400).json({
        message: 'Usuário com este e-mail já existe.'
      });
    }

    user = await User.findOne({
      username
    });
    if (user) {
      return res.status(400).json({
        message: 'Nome de usuário já existe.'
      });
    }

    // Gerar um hash da senha
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Gerar código de referência único
    const referralCode = generateReferralCode(); // Função utilitária para gerar código

    // Criar novo usuário
    user = new User({
      username,
      email,
      password: hashedPassword,
      referralCode,
      // balance já é 50 por padrão no modelo
    });

    await user.save();

    // Adicionar transação de bônus de cadastro
    const signupBonusTransaction = new Transaction({
      userId: user._id,
      type: 'signup_bonus',
      amount: 50,
      status: 'completed',
      description: 'Bônus de cadastro'
    });
    await signupBonusTransaction.save();

    // Enviar e-mail de boas-vindas
    const welcomeEmailHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="background-color: #007BFF; padding: 20px; text-align: center; color: white;">
          <h1 style="margin: 0;">Bem-vindo ao VEED!</h1>
        </div>
        <div style="padding: 20px; background-color: #f4f4f4;">
          <p>Olá ${username},</p>
          <p>Seja muito bem-vindo(a) à plataforma VEED! Estamos muito felizes em tê-lo(a) conosco.</p>
          <p>No VEED, você pode investir seu tempo assistindo a vídeos e ganhar recompensas diárias. Explore nossos planos e comece a ganhar hoje mesmo!</p>
          <p>Lembre-se que você recebeu um **bônus de 50MT** ao se cadastrar. Você poderá sacá-lo quando tiver um plano ativo.</p>
          <p>Se precisar de ajuda, visite nossa página de ajuda ou entre em contato com o suporte.</p>
          <p>Atenciosamente,</p>
          <p>A Equipe VEED</p>
        </div>
        <div style="background-color: #dc3545; padding: 10px; text-align: center; color: white; font-size: 0.8em;">
          <p>&copy; ${new Date().getFullYear()} VEED. Todos os direitos reservados.</p>
        </div>
      </div>
    `;

    await sendEmail(email, 'Bem-vindo(a) ao VEED!', welcomeEmailHtml);

    // Gerar JWT Token
    const payload = {
      user: {
        id: user.id
      }
    };
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: '1h'
    }); // Token expira em 1 hora

    res.status(201).json({
      message: 'Usuário registrado com sucesso! E-mail de boas-vindas enviado.',
      token
    });
  } catch (err) {
    console.error('Erro no registro do usuário:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao registrar usuário.'
    });
  }
};

/**
 * @desc Autentica um usuário e retorna um token JWT.
 * @route POST /login
 * @access Public
 */
exports.loginUser = async (req, res) => {
  const {
    email,
    password
  } = req.body;

  try {
    // Verificar se o usuário existe
    let user = await User.findOne({
      email
    });
    if (!user) {
      return res.status(400).json({
        message: 'Credenciais inválidas.'
      });
    }

    // Comparar a senha fornecida com a senha hash no banco de dados
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        message: 'Credenciais inválidas.'
      });
    }

    // Gerar JWT Token
    const payload = {
      user: {
        id: user.id,
        isAdmin: user.isAdmin // Incluir isAdmin no payload
      }
    };
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: '1h'
    });

    res.json({
      message: 'Login bem-sucedido!',
      token
    });
  } catch (err) {
    console.error('Erro no login do usuário:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao fazer login.'
    });
  }
};

/**
 * @desc Solicita recuperação de senha via email.
 * @route POST /forgot-password
 * @access Public
 */
exports.forgotPassword = async (req, res) => {
  const {
    email
  } = req.body;

  try {
    const user = await User.findOne({
      email
    });
    if (!user) {
      return res.status(404).json({
        message: 'Usuário não encontrado com este e-mail.'
      });
    }

    // Gerar um token de redefinição (pode ser JWT ou um token aleatório)
    const resetToken = jwt.sign({
      id: user.id
    }, JWT_SECRET, {
      expiresIn: '15m'
    }); // Token expira em 15 minutos

    // Em um cenário real, você salvaria este token no banco de dados para o usuário
    // user.resetPasswordToken = resetToken;
    // user.resetPasswordExpires = Date.now() + 900000; // 15 minutos
    // await user.save();

    // Link para redefinição de senha (apontando para o frontend)
    const resetLink = `${req.protocol}://${req.get('host')}/reset-password.html?token=${resetToken}`; // Adapte para a URL real do seu frontend

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="background-color: #007BFF; padding: 20px; text-align: center; color: white;">
          <h1 style="margin: 0;">Redefinição de Senha VEED</h1>
        </div>
        <div style="padding: 20px; background-color: #f4f4f4;">
          <p>Olá ${user.username},</p>
          <p>Você solicitou a redefinição de sua senha na plataforma VEED. Para redefinir sua senha, clique no link abaixo:</p>
          <p style="text-align: center;">
            <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px;">Redefinir Senha</a>
          </p>
          <p>Este link é válido por 15 minutos. Se você não solicitou esta redefinição, por favor, ignore este e-mail.</p>
          <p>Atenciosamente,</p>
          <p>A Equipe VEED</p>
        </div>
        <div style="background-color: #dc3545; padding: 10px; text-align: center; color: white; font-size: 0.8em;">
          <p>&copy; ${new Date().getFullYear()} VEED. Todos os direitos reservados.</p>
        </div>
      </div>
    `;

    await sendEmail(email, 'Redefinição de Senha VEED', emailHtml);

    res.status(200).json({
      message: 'Link de redefinição de senha enviado para o seu e-mail.'
    });

  } catch (err) {
    console.error('Erro ao solicitar redefinição de senha:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao solicitar redefinição de senha.'
    });
  }
};

/**
 * @desc Redefine a senha do usuário com um token válido.
 * @route POST /reset-password/:token
 * @access Public
 */
exports.resetPassword = async (req, res) => {
  const {
    token
  } = req.params;
  const {
    newPassword
  } = req.body;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'Usuário não encontrado.'
      });
    }

    // Verificar se o token ainda é válido (se tivermos salvo no DB)
    // if (user.resetPasswordToken !== token || user.resetPasswordExpires < Date.now()) {
    //     return res.status(400).json({ message: 'Token de redefinição inválido ou expirado.' });
    // }

    // Gerar novo hash para a nova senha
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    // Limpar token de redefinição do DB
    // user.resetPasswordToken = undefined;
    // user.resetPasswordExpires = undefined;

    await user.save();

    res.status(200).json({
      message: 'Senha redefinida com sucesso!'
    });

  } catch (err) {
    console.error('Erro ao redefinir senha:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(400).json({
        message: 'Token de redefinição expirado.'
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(400).json({
        message: 'Token de redefinição inválido.'
      });
    }
    res.status(500).json({
      message: 'Erro no servidor ao redefinir senha.'
    });
  }
};

/**
 * @desc Obtém o perfil do usuário logado.
 * @route GET /profile
 * @access Private
 */
exports.getUserProfile = async (req, res) => {
  try {
    // req.user.id é definido pelo middleware de autenticação
    const user = await User.findById(req.user.id).select('-password'); // Excluir a senha
    if (!user) {
      return res.status(404).json({
        message: 'Usuário não encontrado.'
      });
    }
    res.json(user);
  } catch (err) {
    console.error('Erro ao buscar perfil do usuário:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao buscar perfil do usuário.'
    });
  }
};

/**
 * @desc Atualiza o perfil do usuário logado (incluindo avatar).
 * @route PUT /profile
 * @access Private
 */
exports.updateUserProfile = async (req, res) => {
  const {
    username,
    email
  } = req.body;
  const userId = req.user.id; // ID do usuário logado

  try {
    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'Usuário não encontrado.'
      });
    }

    // Atualizar campos permitidos
    if (username && username !== user.username) {
      const existingUser = await User.findOne({
        username
      });
      if (existingUser && existingUser._id.toString() !== userId) {
        return res.status(400).json({
          message: 'Nome de usuário já está em uso.'
        });
      }
      user.username = username;
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({
        email
      });
      if (existingUser && existingUser._id.toString() !== userId) {
        return res.status(400).json({
          message: 'E-mail já está em uso.'
        });
      }
      user.email = email;
    }

    // Lidar com o upload do avatar se houver um arquivo
    if (req.file && req.file.path) {
      const result = await uploadToCloudinary(req.file.path, 'avatars');
      user.avatar = result.secure_url;
    }

    await user.save();

    res.json({
      message: 'Perfil atualizado com sucesso!',
      user: user.toObject({
        getters: true,
        virtuals: true
      })
    }); // Retorna o usuário atualizado
  } catch (err) {
    console.error('Erro ao atualizar perfil do usuário:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao atualizar perfil do usuário.'
    });
  }
};

/**
 * @desc Altera a senha do usuário logado.
 * @route PUT /change-password
 * @access Private
 */
exports.changePassword = async (req, res) => {
  const {
    currentPassword,
    newPassword
  } = req.body;
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'Usuário não encontrado.'
      });
    }

    // Verificar se a senha atual está correta
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        message: 'Senha atual incorreta.'
      });
    }

    // Hash da nova senha
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({
      message: 'Senha alterada com sucesso!'
    });
  } catch (err) {
    console.error('Erro ao alterar senha:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao alterar senha.'
    });
  }
};

/**
 * @desc Obtém os detalhes da carteira do usuário (saldo e histórico de transações).
 * @route GET /wallet
 * @access Private
 */
exports.getWalletDetails = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('balance');
    if (!user) {
      return res.status(404).json({
        message: 'Usuário não encontrado.'
      });
    }

    const transactions = await Transaction.find({
      userId: req.user.id
    })
      .sort({
        createdAt: -1
      }) // Mais recentes primeiro
      .limit(20); // Limitar para as 20 transações mais recentes

    res.json({
      balance: user.balance,
      transactions
    });
  } catch (err) {
    console.error('Erro ao obter detalhes da carteira:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao obter detalhes da carteira.'
    });
  }
};

/**
 * @desc Obtém o histórico completo de transações do usuário.
 * @route GET /transactions
 * @access Private
 */
exports.getUserTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      userId: req.user.id
    }).sort({
      createdAt: -1
    });
    res.json(transactions);
  } catch (err) {
    console.error('Erro ao buscar transações do usuário:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao buscar transações.'
    });
  }
};


/**
 * @desc Obtém os vídeos disponíveis para o usuário assistir hoje, baseados no plano ativo.
 * @route GET /daily-videos
 * @access Private
 */
exports.getDailyVideos = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('activePlan');

    if (!user) {
      return res.status(404).json({
        message: 'Usuário não encontrado.'
      });
    }
    if (!user.activePlan) {
      return res.status(400).json({
        message: 'Nenhum plano ativo encontrado. Por favor, compre um plano para assistir vídeos.'
      });
    }

    const {
      videosPerDay
    } = user.activePlan;
    const todayInMaputo = moment().tz('Africa/Maputo').startOf('day'); // Início do dia em Maputo
    const lastWatchDateInMaputo = user.lastVideoWatchDate ? moment(user.lastVideoWatchDate).tz('Africa/Maputo').startOf('day') : null;

    // Se a última data de visualização for anterior a hoje, ou se nunca assistiu, resetar a lista de vídeos do dia
    if (!lastWatchDateInMaputo || lastWatchDateInMaputo.isBefore(todayInMaputo)) {
      user.videosWatchedToday = [];
      user.lastVideoWatchDate = new Date(); // Atualiza para a data atual
      await user.save();
    }

    // IDs dos vídeos já assistidos por este usuário neste plano
    const watchedVideoIds = await UserVideoHistory.find({
      userId: user._id,
      planId: user.activePlan._id,
      watchDate: {
        $gte: todayInMaputo.toDate()
      } // Apenas vídeos assistidos hoje
    }).distinct('videoId');


    // Encontrar vídeos que não foram assistidos hoje e que não fazem parte do histórico recente (para evitar repetição em curto prazo)
    const availableVideos = await Video.aggregate([{
      $match: {
        _id: {
          $nin: watchedVideoIds
        }
      }
    }, {
      $sample: {
        size: videosPerDay * 5
      }
    }, // Pega um número maior para ter opções para filtrar
    ]);

    // Filtrar para garantir que não se repitam no histórico geral do usuário se possível
    const uniqueDailyVideos = [];
    const userTotalWatchedVideosIds = await UserVideoHistory.find({
      userId: user._id,
      planId: user.activePlan._id
    }).distinct('videoId');

    for (const video of availableVideos) {
      if (uniqueDailyVideos.length < videosPerDay && !userTotalWatchedVideosIds.includes(video._id)) {
        uniqueDailyVideos.push(video);
      }
    }

    // Se não tiver vídeos suficientes que não foram vistos antes, permite alguns que já foram vistos mas não hoje
    if (uniqueDailyVideos.length < videosPerDay) {
      const remainingNeeded = videosPerDay - uniqueDailyVideos.length;
      const previouslyWatchedButNotToday = availableVideos.filter(video =>
        !uniqueDailyVideos.map(v => v._id.toString()).includes(video._id.toString()) &&
        watchedVideoIds.map(id => id.toString()).includes(video._id.toString()) // Já foi visto, mas não hoje
      );
      for (const video of previouslyWatchedButNotToday) {
        if (uniqueDailyVideos.length < videosPerDay) {
          uniqueDailyVideos.push(video);
        }
      }
    }

    res.json({
      dailyLimit: videosPerDay,
      videosWatchedToday: user.videosWatchedToday.length,
      remainingVideos: videosPerDay - user.videosWatchedToday.length,
      videos: uniqueDailyVideos,
      currentTime: moment().tz('Africa/Maputo').format()
    });

  } catch (err) {
    console.error('Erro ao obter vídeos diários:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao obter vídeos diários.'
    });
  }
};

/**
 * @desc Registra que um usuário assistiu a um vídeo e concede recompensa.
 * @route POST /watch-video/:videoId
 * @access Private
 */
exports.watchVideo = async (req, res) => {
  const {
    videoId
  } = req.params;
  const userId = req.user.id;

  try {
    const user = await User.findById(userId).populate('activePlan');

    if (!user) {
      return res.status(404).json({
        message: 'Usuário não encontrado.'
      });
    }
    if (!user.activePlan) {
      return res.status(400).json({
        message: 'Nenhum plano ativo. Por favor, compre um plano para assistir vídeos.'
      });
    }

    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({
        message: 'Vídeo não encontrado.'
      });
    }

    const {
      videosPerDay,
      rewardPerVideo
    } = user.activePlan;
    const todayInMaputo = moment().tz('Africa/Maputo').startOf('day');

    // Verificar se o usuário já assistiu o limite de vídeos hoje
    const videosWatchedTodayCount = await UserVideoHistory.countDocuments({
      userId: userId,
      planId: user.activePlan._id,
      watchDate: {
        $gte: todayInMaputo.toDate()
      },
      isCompleted: true
    });

    if (videosWatchedTodayCount >= videosPerDay) {
      return res.status(400).json({
        message: `Você já assistiu seu limite de ${videosPerDay} vídeos hoje.`
      });
    }

    // Verificar se o vídeo já foi assistido E COMPLETO hoje
    const alreadyWatchedToday = await UserVideoHistory.findOne({
      userId: userId,
      videoId: videoId,
      planId: user.activePlan._id,
      watchDate: {
        $gte: todayInMaputo.toDate()
      },
      isCompleted: true
    });

    if (alreadyWatchedToday) {
      return res.status(400).json({
        message: 'Você já assistiu este vídeo completamente hoje.'
      });
    }

    // Registrar o vídeo como assistido (ou atualizar um registro existente para completo)
    let userVideoRecord = await UserVideoHistory.findOne({
      userId: userId,
      videoId: videoId,
      planId: user.activePlan._id,
      watchDate: {
        $gte: todayInMaputo.toDate()
      }
    });

    if (userVideoRecord) {
      userVideoRecord.isCompleted = true;
      userVideoRecord.rewardEarned = rewardPerVideo;
      await userVideoRecord.save();
    } else {
      userVideoRecord = new UserVideoHistory({
        userId: userId,
        videoId: videoId,
        planId: user.activePlan._id,
        watchDate: new Date(),
        isCompleted: true,
        rewardEarned: rewardPerVideo
      });
      await userVideoRecord.save();
    }


    // Atualizar saldo do usuário
    user.balance += rewardPerVideo;
    user.lastVideoWatchDate = new Date(); // Atualiza a data da última visualização
    user.totalVideosWatched += 1; // Incrementa o contador geral de vídeos assistidos
    await user.save();

    // Adicionar transação de recompensa
    const rewardTransaction = new Transaction({
      userId: userId,
      type: 'video_reward',
      amount: rewardPerVideo,
      status: 'completed',
      description: `Recompensa por assistir vídeo "${video.title}"`
    });
    await rewardTransaction.save();

    // Lógica para bônus de referência (5% da renda diária do indicado)
    if (user.referredBy) {
      const referrer = await User.findById(user.referredBy);
      if (referrer) {
        const referralDailyBonus = rewardPerVideo * 0.05; // 5% da renda diária
        referrer.balance += referralDailyBonus;
        await referrer.save();

        const referralBonusTransaction = new Transaction({
          userId: referrer._id,
          type: 'referral_bonus_daily',
          amount: referralDailyBonus,
          status: 'completed',
          description: `Bônus de 5% da recompensa diária do indicado ${user.username}`
        });
        await referralBonusTransaction.save();
      }
    }

    res.json({
      message: `Vídeo "${video.title}" assistido. Você ganhou ${rewardPerVideo}MT!`,
      newBalance: user.balance,
      videosWatchedToday: videosWatchedTodayCount + 1 // Incluindo o vídeo atual
    });

  } catch (err) {
    console.error('Erro ao assistir vídeo:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao registrar visualização do vídeo.'
    });
  }
};

/**
 * @desc Obtém informações sobre o sistema de referência do usuário.
 * @route GET /referrals
 * @access Private
 */
exports.getReferralInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('referralCode');
    if (!user) {
      return res.status(404).json({
        message: 'Usuário não encontrado.'
      });
    }

    // Encontrar usuários referidos por este usuário
    const referredUsers = await User.find({
      referredBy: user._id
    }).select('username email activePlan');

    // Calcular ganhos totais de referência (pode ser complexo, simplificando aqui)
    const totalReferralEarnings = await Transaction.aggregate([{
      $match: {
        userId: user._id,
        type: {
          $in: ['referral_bonus_plan', 'referral_bonus_daily']
        }
      }
    }, {
      $group: {
        _id: null,
        total: {
          $sum: '$amount'
        }
      }
    }]);

    res.json({
      yourReferralCode: user.referralCode,
      referralLink: `${req.protocol}://${req.get('host')}/register.html?ref=${user.referralCode}`, // Exemplo de link
      referredUsers: referredUsers,
      totalReferralEarnings: totalReferralEarnings.length > 0 ? totalReferralEarnings[0].total : 0
    });

  } catch (err) {
    console.error('Erro ao obter informações de referência:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao obter informações de referência.'
    });
  }
};


// --- Funções de Depósito ---

/**
 * @desc Solicita um depósito via M-Pesa/e-Mola.
 * @route POST /deposit
 * @access Private
 */
exports.requestDeposit = async (req, res) => {
  const {
    amount,
    paymentMethod,
    proofText // Se o usuário colar o texto
  } = req.body;
  const userId = req.user.id;

  try {
    let proofUrl = null;
    // Se houver um arquivo, processar upload para o Cloudinary
    if (req.file && req.file.path) {
      const result = await uploadToCloudinary(req.file.path, 'deposit_proofs');
      proofUrl = result.secure_url;
    } else if (proofText) {
      proofUrl = proofText; // Usar o texto como prova se não houver imagem
    } else {
      return res.status(400).json({
        message: 'É necessário fornecer um comprovante (imagem ou texto).'
      });
    }

    const deposit = new Deposit({
      userId,
      amount,
      paymentMethod,
      proof: proofUrl,
      status: 'pending' // Status inicial
    });
    await deposit.save();

    // Registrar a transação como pendente
    const transaction = new Transaction({
      userId,
      type: 'deposit',
      amount,
      status: 'pending',
      relatedEntity: deposit._id,
      description: `Depósito pendente via ${paymentMethod}`
    });
    await transaction.save();


    res.status(202).json({
      message: 'Solicitação de depósito enviada com sucesso! Aguardando aprovação do administrador.',
      deposit
    });
  } catch (err) {
    console.error('Erro ao solicitar depósito:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao solicitar depósito.'
    });
  }
};

/**
 * @desc Obtém o histórico de depósitos do usuário.
 * @route GET /deposits/user
 * @access Private
 */
exports.getUserDeposits = async (req, res) => {
  try {
    const deposits = await Deposit.find({
      userId: req.user.id
    }).sort({
      createdAt: -1
    });
    res.json(deposits);
  } catch (err) {
    console.error('Erro ao buscar depósitos do usuário:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao buscar depósitos do usuário.'
    });
  }
};


// --- Funções de Levantamento (Saque) ---

/**
 * @desc Solicita um levantamento (saque) via M-Pesa/e-Mola.
 * @route POST /withdraw
 * @access Private
 */
exports.requestWithdrawal = async (req, res) => {
  const {
    amount,
    paymentMethod,
    phoneNumber
  } = req.body;
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'Usuário não encontrado.'
      });
    }

    // Verificar se o usuário tem saldo suficiente
    if (user.balance < amount) {
      return res.status(400).json({
        message: 'Saldo insuficiente para esta retirada.'
      });
    }

    // O bônus de 50MT só pode ser sacado se o usuário tiver um plano ativo
    if (user.balance >= 50 && amount >= 50 && !user.activePlan) {
      return res.status(400).json({
        message: 'O bônus de 50MT só pode ser sacado quando você tiver um plano ativo.'
      });
    }


    // Criar o pedido de levantamento
    const withdrawal = new Withdrawal({
      userId,
      amount,
      paymentMethod,
      phoneNumber,
      status: 'pending'
    });
    await withdrawal.save();

    // Reduzir o saldo do usuário imediatamente (ou após aprovação, dependendo da regra de negócio)
    // Para este caso, vamos reduzir após aprovação para o admin enviar manualmente.
    // user.balance -= amount;
    // await user.save();

    // Registrar a transação como pendente
    const transaction = new Transaction({
      userId,
      type: 'withdrawal',
      amount: -amount, // Negativo para indicar saída
      status: 'pending',
      relatedEntity: withdrawal._id,
      description: `Pedido de levantamento pendente via ${paymentMethod}`
    });
    await transaction.save();


    res.status(202).json({
      message: 'Solicitação de levantamento enviada com sucesso! Aguardando aprovação do administrador.'
    });
  } catch (err) {
    console.error('Erro ao solicitar levantamento:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao solicitar levantamento.'
    });
  }
};

/**
 * @desc Obtém o histórico de levantamentos do usuário.
 * @route GET /withdrawals/user
 * @access Private
 */
exports.getUserWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({
      userId: req.user.id
    }).sort({
      createdAt: -1
    });
    res.json(withdrawals);
  } catch (err) {
    console.error('Erro ao buscar levantamentos do usuário:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao buscar levantamentos do usuário.'
    });
  }
};

// --- Funções de Planos (Usuário) ---

/**
 * @desc Obtém todos os planos disponíveis.
 * @route GET /plans
 * @access Private (ou Public, dependendo se usuários não logados podem ver)
 */
exports.getAllPlans = async (req, res) => {
  try {
    const plans = await Plan.find({});
    res.json(plans);
  } catch (err) {
    console.error('Erro ao buscar planos:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao buscar planos.'
    });
  }
};

/**
 * @desc Permite ao usuário comprar um plano.
 * @route POST /plan/purchase
 * @access Private
 */
exports.purchasePlan = async (req, res) => {
  const {
    planId
  } = req.body;
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'Usuário não encontrado.'
      });
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        message: 'Plano não encontrado.'
      });
    }

    // Verificar se o usuário já possui um plano ativo
    if (user.activePlan) {
      return res.status(400).json({
        message: 'Você já possui um plano ativo. Conclua-o ou cancele-o para comprar um novo.'
      });
    }

    // Verificar se o usuário tem saldo suficiente
    if (user.balance < plan.value) {
      return res.status(400).json({
        message: 'Saldo insuficiente para comprar este plano. Por favor, faça um depósito.'
      });
    }

    // Deduzir o valor do plano do saldo do usuário
    user.balance -= plan.value;
    user.activePlan = plan._id;
    await user.save();

    // Adicionar transação de compra do plano
    const purchaseTransaction = new Transaction({
      userId: userId,
      type: 'plan_purchase',
      amount: -plan.value, // Negativo para indicar saída
      status: 'completed',
      relatedEntity: plan._id,
      description: `Compra do plano "${plan.name}"`
    });
    await purchaseTransaction.save();

    // Lógica para bônus de referência (10% do valor do plano)
    if (user.referredBy) {
      const referrer = await User.findById(user.referredBy);
      if (referrer) {
        const referralPlanBonus = plan.value * 0.10; // 10% do valor do plano
        referrer.balance += referralPlanBonus;
        await referrer.save();

        const referralBonusTransaction = new Transaction({
          userId: referrer._id,
          type: 'referral_bonus_plan',
          amount: referralPlanBonus,
          status: 'completed',
          description: `Bônus de 10% pela compra do plano ${plan.name} do indicado ${user.username}`
        });
        await referralBonusTransaction.save();
      }
    }

    res.status(200).json({
      message: `Plano "${plan.name}" comprado com sucesso! Seu novo saldo é ${user.balance}MT.`,
      newBalance: user.balance,
      activePlan: plan
    });

  } catch (err) {
    console.error('Erro ao comprar plano:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao comprar plano.'
    });
  }
};


// --- Funções do Administrador ---

/**
 * @desc Cria um novo plano de investimento.
 * @route POST /admin/plans
 * @access Private (Admin Only)
 */
exports.createPlan = async (req, res) => {
  const {
    name,
    value,
    videosPerDay,
    duration
  } = req.body;

  try {
    // Calcular recompensa total e recompensa por vídeo
    const totalReward = videosPerDay * duration * (value / (videosPerDay * duration) * 3); // Exemplo de cálculo, ajuste conforme a lógica de ROI desejada
    const rewardPerVideo = totalReward / (videosPerDay * duration); // Recompensa por vídeo

    const plan = new Plan({
      name,
      value,
      rewardPerVideo: parseFloat(rewardPerVideo.toFixed(2)), // Arredondar para 2 casas decimais
      videosPerDay,
      duration,
      totalReward: parseFloat(totalReward.toFixed(2)) // Arredondar
    });
    await plan.save();
    res.status(201).json({
      message: 'Plano criado com sucesso!',
      plan
    });
  } catch (err) {
    console.error('Erro ao criar plano:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao criar plano.'
    });
  }
};


/**
 * @desc Atualiza um plano existente.
 * @route PUT /admin/plans/:planId
 * @access Private (Admin Only)
 */
exports.updatePlan = async (req, res) => {
  const {
    planId
  } = req.params;
  const {
    name,
    value,
    videosPerDay,
    duration
  } = req.body;

  try {
    let plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        message: 'Plano não encontrado.'
      });
    }

    plan.name = name || plan.name;
    plan.value = value || plan.value;
    plan.videosPerDay = videosPerDay || plan.videosPerDay;
    plan.duration = duration || plan.duration;

    // Recalcular recompensas se os parâmetros mudarem
    if (value || videosPerDay || duration) {
      const newTotalReward = plan.videosPerDay * plan.duration * (plan.value / (plan.videosPerDay * plan.duration) * 3);
      plan.totalReward = parseFloat(newTotalReward.toFixed(2));
      plan.rewardPerVideo = parseFloat((newTotalReward / (plan.videosPerDay * plan.duration)).toFixed(2));
    }

    await plan.save();
    res.json({
      message: 'Plano atualizado com sucesso!',
      plan
    });
  } catch (err) {
    console.error('Erro ao atualizar plano:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao atualizar plano.'
    });
  }
};

/**
 * @desc Deleta um plano existente.
 * @route DELETE /admin/plans/:planId
 * @access Private (Admin Only)
 */
exports.deletePlan = async (req, res) => {
  const {
    planId
  } = req.params;

  try {
    const plan = await Plan.findByIdAndDelete(planId);
    if (!plan) {
      return res.status(404).json({
        message: 'Plano não encontrado.'
      });
    }
    res.json({
      message: 'Plano deletado com sucesso!'
    });
  } catch (err) {
    console.error('Erro ao deletar plano:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao deletar plano.'
    });
  }
};


/**
 * @desc Adiciona um novo vídeo.
 * @route POST /admin/videos
 * @access Private (Admin Only)
 */
exports.addVideo = async (req, res) => {
  const {
    title,
    description,
    duration
  } = req.body;

  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({
        message: 'Nenhum arquivo de vídeo enviado.'
      });
    }

    const result = await uploadToCloudinary(req.file.path, 'videos', 'video'); // Faz upload do vídeo
    const video = new Video({
      title,
      description,
      videoUrl: result.secure_url,
      duration // Duração deve ser enviada pelo frontend ou obtida do Cloudinary (mais complexo)
    });
    await video.save();
    res.status(201).json({
      message: 'Vídeo adicionado com sucesso!',
      video
    });
  } catch (err) {
    console.error('Erro ao adicionar vídeo:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao adicionar vídeo.'
    });
  }
};

/**
 * @desc Atualiza um vídeo existente.
 * @route PUT /admin/videos/:videoId
 * @access Private (Admin Only)
 */
exports.updateVideo = async (req, res) => {
  const {
    videoId
  } = req.params;
  const {
    title,
    description,
    duration
  } = req.body;

  try {
    let video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({
        message: 'Vídeo não encontrado.'
      });
    }

    video.title = title || video.title;
    video.description = description || video.description;
    video.duration = duration || video.duration;

    // Se um novo arquivo de vídeo for enviado, atualize o URL
    if (req.file && req.file.path) {
      const result = await uploadToCloudinary(req.file.path, 'videos', 'video');
      video.videoUrl = result.secure_url;
    }

    await video.save();
    res.json({
      message: 'Vídeo atualizado com sucesso!',
      video
    });
  } catch (err) {
    console.error('Erro ao atualizar vídeo:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao atualizar vídeo.'
    });
  }
};

/**
 * @desc Deleta um vídeo existente.
 * @route DELETE /admin/videos/:videoId
 * @access Private (Admin Only)
 */
exports.deleteVideo = async (req, res) => {
  const {
    videoId
  } = req.params;

  try {
    const video = await Video.findByIdAndDelete(videoId);
    if (!video) {
      return res.status(404).json({
        message: 'Vídeo não encontrado.'
      });
    }

    // Opcional: Deletar o vídeo do Cloudinary também
    // const publicId = video.videoUrl.split('/').pop().split('.')[0]; // Extrai o public_id do URL
    // await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });

    res.json({
      message: 'Vídeo deletado com sucesso!'
    });
  } catch (err) {
    console.error('Erro ao deletar vídeo:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao deletar vídeo.'
    });
  }
};

/**
 * @desc Lista todos os vídeos cadastrados.
 * @route GET /admin/videos
 * @access Private (Admin Only)
 */
exports.getAllVideos = async (req, res) => {
  try {
    const videos = await Video.find({});
    res.json(videos);
  } catch (err) {
    console.error('Erro ao listar vídeos:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao listar vídeos.'
    });
  }
};


/**
 * @desc Obtém a lista de depósitos pendentes.
 * @route GET /admin/deposits/pending
 * @access Private (Admin Only)
 */
exports.getPendingDeposits = async (req, res) => {
  try {
    const deposits = await Deposit.find({
      status: 'pending'
    }).populate('userId', 'username email'); // Popula informações do usuário
    res.json(deposits);
  } catch (err) {
    console.error('Erro ao buscar depósitos pendentes:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao buscar depósitos pendentes.'
    });
  }
};

/**
 * @desc Aprova um depósito e adiciona o valor ao saldo do usuário.
 * @route PUT /admin/deposits/:depositId/approve
 * @access Private (Admin Only)
 */
exports.approveDeposit = async (req, res) => {
  const {
    depositId
  } = req.params;
  const adminId = req.user.id;

  try {
    const deposit = await Deposit.findById(depositId);
    if (!deposit) {
      return res.status(404).json({
        message: 'Depósito não encontrado.'
      });
    }
    if (deposit.status !== 'pending') {
      return res.status(400).json({
        message: 'Depósito já foi processado.'
      });
    }

    deposit.status = 'approved';
    deposit.approvedBy = adminId;
    await deposit.save();

    // Atualizar saldo do usuário
    const user = await User.findById(deposit.userId);
    if (user) {
      user.balance += deposit.amount;
      await user.save();
    }

    // Atualizar transação para 'completed'
    await Transaction.findOneAndUpdate({
      relatedEntity: deposit._id,
      type: 'deposit'
    }, {
      status: 'completed',
      description: `Depósito aprovado de ${deposit.amount}MT`
    });

    res.json({
      message: 'Depósito aprovado com sucesso!',
      deposit
    });
  } catch (err) {
    console.error('Erro ao aprovar depósito:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao aprovar depósito.'
    });
  }
};

/**
 * @desc Rejeita um depósito.
 * @route PUT /admin/deposits/:depositId/reject
 * @access Private (Admin Only)
 */
exports.rejectDeposit = async (req, res) => {
  const {
    depositId
  } = req.params;
  const adminId = req.user.id;

  try {
    const deposit = await Deposit.findById(depositId);
    if (!deposit) {
      return res.status(404).json({
        message: 'Depósito não encontrado.'
      });
    }
    if (deposit.status !== 'pending') {
      return res.status(400).json({
        message: 'Depósito já foi processado.'
      });
    }

    deposit.status = 'rejected';
    deposit.approvedBy = adminId;
    await deposit.save();

    // Atualizar transação para 'failed'
    await Transaction.findOneAndUpdate({
      relatedEntity: deposit._id,
      type: 'deposit'
    }, {
      status: 'failed',
      description: `Depósito rejeitado de ${deposit.amount}MT`
    });

    res.json({
      message: 'Depósito rejeitado com sucesso!',
      deposit
    });
  } catch (err) {
    console.error('Erro ao rejeitar depósito:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao rejeitar depósito.'
    });
  }
};


/**
 * @desc Obtém a lista de levantamentos pendentes.
 * @route GET /admin/withdrawals/pending
 * @access Private (Admin Only)
 */
exports.getPendingWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({
      status: 'pending'
    }).populate('userId', 'username email');
    res.json(withdrawals);
  } catch (err) {
    console.error('Erro ao buscar levantamentos pendentes:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao buscar levantamentos pendentes.'
    });
  }
};

/**
 * @desc Aprova um levantamento e deduz o valor do saldo do usuário.
 * @route PUT /admin/withdrawals/:withdrawalId/approve
 * @access Private (Admin Only)
 */
exports.approveWithdrawal = async (req, res) => {
  const {
    withdrawalId
  } = req.params;
  const adminId = req.user.id; // Admin que está processando

  try {
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({
        message: 'Pedido de levantamento não encontrado.'
      });
    }
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        message: 'Pedido de levantamento já foi processado.'
      });
    }

    // Encontrar o usuário e deduzir o saldo
    const user = await User.findById(withdrawal.userId);
    if (!user) {
      return res.status(404).json({
        message: 'Usuário do levantamento não encontrado.'
      });
    }

    // Verificar novamente o saldo antes de deduzir, para garantir (caso haja concorrência)
    if (user.balance < withdrawal.amount) {
      withdrawal.status = 'rejected'; // Marcar como rejeitado por saldo insuficiente
      withdrawal.processedBy = adminId;
      await withdrawal.save();
      await Transaction.findOneAndUpdate({
        relatedEntity: withdrawal._id,
        type: 'withdrawal'
      }, {
        status: 'failed',
        description: `Levantamento rejeitado por saldo insuficiente de ${withdrawal.amount}MT`
      });
      return res.status(400).json({
        message: 'Saldo do usuário insuficiente para processar este levantamento.'
      });
    }

    user.balance -= withdrawal.amount;
    await user.save();

    withdrawal.status = 'approved';
    withdrawal.processedBy = adminId;
    await withdrawal.save();

    // Atualizar transação para 'completed'
    await Transaction.findOneAndUpdate({
      relatedEntity: withdrawal._id,
      type: 'withdrawal'
    }, {
      status: 'completed',
      description: `Levantamento aprovado de ${withdrawal.amount}MT`
    });

    res.json({
      message: 'Levantamento aprovado e processado com sucesso!',
      withdrawal
    });
  } catch (err) {
    console.error('Erro ao aprovar levantamento:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao aprovar levantamento.'
    });
  }
};

/**
 * @desc Rejeita um levantamento.
 * @route PUT /admin/withdrawals/:withdrawalId/reject
 * @access Private (Admin Only)
 */
exports.rejectWithdrawal = async (req, res) => {
  const {
    withdrawalId
  } = req.params;
  const adminId = req.user.id;

  try {
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({
        message: 'Pedido de levantamento não encontrado.'
      });
    }
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        message: 'Pedido de levantamento já foi processado.'
      });
    }

    withdrawal.status = 'rejected';
    withdrawal.processedBy = adminId;
    await withdrawal.save();

    // Atualizar transação para 'failed'
    await Transaction.findOneAndUpdate({
      relatedEntity: withdrawal._id,
      type: 'withdrawal'
    }, {
      status: 'failed',
      description: `Levantamento rejeitado de ${withdrawal.amount}MT`
    });

    res.json({
      message: 'Levantamento rejeitado com sucesso!',
      withdrawal
    });
  } catch (err) {
    console.error('Erro ao rejeitar levantamento:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao rejeitar levantamento.'
    });
  }
};

/**
 * @desc Obtém a lista de todos os usuários.
 * @route GET /admin/users
 * @access Private (Admin Only)
 */
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password'); // Excluir senhas
    res.json(users);
  } catch (err) {
    console.error('Erro ao buscar todos os usuários:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao buscar usuários.'
    });
  }
};

/**
 * @desc Obtém detalhes de um usuário específico.
 * @route GET /admin/users/:userId
 * @access Private (Admin Only)
 */
exports.getUserDetails = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password').populate('activePlan');
    if (!user) {
      return res.status(404).json({
        message: 'Usuário não encontrado.'
      });
    }
    res.json(user);
  } catch (err) {
    console.error('Erro ao buscar detalhes do usuário:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao buscar detalhes do usuário.'
    });
  }
};

/**
 * @desc Bloqueia um usuário.
 * @route PUT /admin/users/:userId/block
 * @access Private (Admin Only)
 */
exports.blockUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.userId, {
      isBlocked: true
    }, {
      new: true
    }).select('-password');
    if (!user) {
      return res.status(404).json({
        message: 'Usuário não encontrado.'
      });
    }
    res.json({
      message: 'Usuário bloqueado com sucesso!',
      user
    });
  } catch (err) {
    console.error('Erro ao bloquear usuário:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao bloquear usuário.'
    });
  }
};

/**
 * @desc Desbloqueia um usuário.
 * @route PUT /admin/users/:userId/unblock
 * @access Private (Admin Only)
 */
exports.unblockUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.userId, {
      isBlocked: false
    }, {
      new: true
    }).select('-password');
    if (!user) {
      return res.status(404).json({
        message: 'Usuário não encontrado.'
      });
    }
    res.json({
      message: 'Usuário desbloqueado com sucesso!',
      user
    });
  } catch (err) {
    console.error('Erro ao desbloquear usuário:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao desbloquear usuário.'
    });
  }
};

/**
 * @desc Adiciona saldo manualmente a um usuário.
 * @route POST /admin/users/:userId/add-balance
 * @access Private (Admin Only)
 */
exports.addBalanceToUser = async (req, res) => {
  const {
    amount
  } = req.body;
  const userIdToUpdate = req.params.userId;

  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({
      message: 'O valor a adicionar deve ser um número positivo.'
    });
  }

  try {
    const user = await User.findById(userIdToUpdate);
    if (!user) {
      return res.status(404).json({
        message: 'Usuário não encontrado.'
      });
    }

    user.balance += amount;
    await user.save();

    // Registrar a transação
    const transaction = new Transaction({
      userId: user._id,
      type: 'deposit',
      amount: amount,
      status: 'completed',
      description: `Saldo adicionado manualmente pelo admin`
    });
    await transaction.save();

    res.json({
      message: `Saldo de ${amount}MT adicionado a ${user.username}. Novo saldo: ${user.balance}MT.`,
      newBalance: user.balance
    });
  } catch (err) {
    console.error('Erro ao adicionar saldo manualmente:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao adicionar saldo.'
    });
  }
};

/**
 * @desc Remove saldo manualmente de um usuário.
 * @route POST /admin/users/:userId/remove-balance
 * @access Private (Admin Only)
 */
exports.removeBalanceFromUser = async (req, res) => {
  const {
    amount
  } = req.body;
  const userIdToUpdate = req.params.userId;

  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({
      message: 'O valor a remover deve ser um número positivo.'
    });
  }

  try {
    const user = await User.findById(userIdToUpdate);
    if (!user) {
      return res.status(404).json({
        message: 'Usuário não encontrado.'
      });
    }

    if (user.balance < amount) {
      return res.status(400).json({
        message: 'Saldo insuficiente para remover este valor.'
      });
    }

    user.balance -= amount;
    await user.save();

    // Registrar a transação
    const transaction = new Transaction({
      userId: user._id,
      type: 'withdrawal', // Ou um novo tipo como 'admin_deduction'
      amount: -amount,
      status: 'completed',
      description: `Saldo removido manualmente pelo admin`
    });
    await transaction.save();

    res.json({
      message: `Saldo de ${amount}MT removido de ${user.username}. Novo saldo: ${user.balance}MT.`,
      newBalance: user.balance
    });
  } catch (err) {
    console.error('Erro ao remover saldo manualmente:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao remover saldo.'
    });
  }
};


/**
 * @desc Obtém estatísticas gerais para o painel administrativo.
 * @route GET /admin/dashboard-stats
 * @access Private (Admin Only)
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalPlans = await Plan.countDocuments();
    const totalVideos = await Video.countDocuments();
    const pendingDeposits = await Deposit.countDocuments({
      status: 'pending'
    });
    const pendingWithdrawals = await Withdrawal.countDocuments({
      status: 'pending'
    });

    const totalDeposited = await Deposit.aggregate([{
      $match: {
        status: 'approved'
      }
    }, {
      $group: {
        _id: null,
        total: {
          $sum: '$amount'
        }
      }
    }]);

    const totalWithdrawn = await Withdrawal.aggregate([{
      $match: {
        status: 'approved'
      }
    }, {
      $group: {
        _id: null,
        total: {
          $sum: '$amount'
        }
      }
    }]);

    const totalBalanceInSystem = await User.aggregate([{
      $group: {
        _id: null,
        total: {
          $sum: '$balance'
        }
      }
    }]);


    res.json({
      totalUsers,
      totalPlans,
      totalVideos,
      pendingDeposits,
      pendingWithdrawals,
      totalDeposited: totalDeposited.length > 0 ? totalDeposited[0].total : 0,
      totalWithdrawn: totalWithdrawn.length > 0 ? totalWithdrawn[0].total : 0,
      totalBalanceInSystem: totalBalanceInSystem.length > 0 ? totalBalanceInSystem[0].total : 0,
    });
  } catch (err) {
    console.error('Erro ao obter estatísticas do dashboard:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao obter estatísticas do dashboard.'
    });
  }
};