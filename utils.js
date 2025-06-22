// utils.js
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const {
  v4: uuidv4
} = require('uuid'); // Para gerar códigos de referência únicos
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const path = require('path');
const {
  User
} = require('./models'); // Precisamos do modelo User para verificação isAdmin e outros


// --- Configurações e Funções de E-mail (Nodemailer) ---

// Configuração do transportador de e-mail
const transporter = nodemailer.createTransport({
  service: 'gmail', // Usando Gmail
  auth: {
    user: process.env.EMAIL_USER, // Seu e-mail do Gmail
    pass: process.env.EMAIL_PASS // Sua senha de aplicativo do Gmail
  }
});

/**
 * @desc Envia um e-mail com conteúdo HTML.
 * @param {string} to - Endereço de e-mail do destinatário.
 * @param {string} subject - Assunto do e-mail.
 * @param {string} htmlContent - Conteúdo do e-mail em formato HTML.
 */
exports.sendEmail = async (to, subject, htmlContent) => {
  try {
    const mailOptions = {
      from: `VEED <${process.env.EMAIL_USER}>`, // Nome da plataforma e seu e-mail
      to,
      subject,
      html: htmlContent,
    };
    await transporter.sendMail(mailOptions);
    console.log(`E-mail enviado para ${to}: "${subject}"`);
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
  }
};


// --- Funções de Autenticação (JWT) ---

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('Erro: JWT_SECRET não definido no arquivo .env');
  process.exit(1);
}

/**
 * @desc Middleware para autenticar requisições usando JWT.
 * @param {object} req - Objeto de requisição.
 * @param {object} res - Objeto de resposta.
 * @param {function} next - Próxima função middleware.
 */
exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato: Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      message: 'Acesso negado. Nenhum token fornecido.'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(403).json({
          message: 'Token expirado. Por favor, faça login novamente.'
        });
      }
      return res.status(403).json({
        message: 'Token inválido.'
      });
    }
    req.user = decoded.user; // Adiciona o payload do usuário à requisição
    next();
  });
};

/**
 * @desc Middleware para autorizar acesso apenas a administradores.
 * @param {object} req - Objeto de requisição.
 * @param {object} res - Objeto de resposta.
 * @param {function} next - Próxima função middleware.
 */
exports.authorizeAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.isAdmin) {
      return res.status(403).json({
        message: 'Acesso negado. Requer privilégios de administrador.'
      });
    }
    next();
  } catch (err) {
    console.error('Erro na autorização do admin:', err.message);
    res.status(500).json({
      message: 'Erro no servidor ao verificar privilégios de administrador.'
    });
  }
};


// --- Funções de Upload de Arquivos (Multer e Cloudinary) ---

// Configuração do Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configuração do Multer para armazenamento temporário em memória
const storage = multer.memoryStorage(); // Armazena o arquivo em um buffer na memória
const upload = multer({
  storage: storage
});

/**
 * @desc Função para fazer upload de um arquivo para o Cloudinary.
 * @param {string} filePath - O caminho do arquivo (se for de disco) ou buffer (se for de memória).
 * @param {string} folder - A pasta no Cloudinary onde o arquivo será armazenado.
 * @param {string} resourceType - O tipo de recurso ('image' ou 'video'). Padrão 'image'.
 * @returns {Promise<object>} - Uma promessa que resolve para os dados do upload do Cloudinary.
 */
exports.uploadToCloudinary = (fileBuffer, folder, resourceType = 'image') => {
  return new Promise((resolve, reject) => {
    // Usar data URI para upload a partir de buffer
    const uploadStream = cloudinary.uploader.upload_stream({
      folder: folder,
      resource_type: resourceType
    }, (error, result) => {
      if (error) {
        return reject(error);
      }
      resolve(result);
    });
    // Escrever o buffer no stream do Cloudinary
    uploadStream.end(fileBuffer);
  });
};


/**
 * @desc Middleware para upload de Avatar.
 * @route POST /profile (com upload)
 */
exports.uploadAvatar = (req, res, next) => {
  upload.single('avatar')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer error (uploadAvatar):', err);
      return res.status(400).json({
        message: 'Erro no upload do avatar: ' + err.message
      });
    } else if (err) {
      console.error('Erro desconhecido no upload do avatar:', err);
      return res.status(500).json({
        message: 'Erro interno do servidor ao fazer upload do avatar.'
      });
    }

    // Se houver um arquivo, o buffer estará em req.file.buffer
    if (req.file) {
      try {
        const result = await exports.uploadToCloudinary(req.file.buffer, 'veed_avatars', 'image');
        req.file.path = result.secure_url; // Armazena o URL do Cloudinary no req.file.path para o controller
        next();
      } catch (cloudinaryErr) {
        console.error('Erro no upload do avatar para o Cloudinary:', cloudinaryErr);
        return res.status(500).json({
          message: 'Falha ao fazer upload do avatar para o Cloudinary.'
        });
      }
    } else {
      next(); // Continua se não houver arquivo (avatar não é obrigatório)
    }
  });
};

/**
 * @desc Middleware para upload de Comprovante de Depósito.
 * @route POST /deposit (com upload)
 */
exports.uploadProof = (req, res, next) => {
  upload.single('proof')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer error (uploadProof):', err);
      return res.status(400).json({
        message: 'Erro no upload do comprovante: ' + err.message
      });
    } else if (err) {
      console.error('Erro desconhecido no upload do comprovante:', err);
      return res.status(500).json({
        message: 'Erro interno do servidor ao fazer upload do comprovante.'
      });
    }

    if (req.file) {
      try {
        const result = await exports.uploadToCloudinary(req.file.buffer, 'veed_proofs', 'image');
        req.file.path = result.secure_url; // Armazena o URL do Cloudinary no req.file.path para o controller
        next();
      } catch (cloudinaryErr) {
        console.error('Erro no upload do comprovante para o Cloudinary:', cloudinaryErr);
        return res.status(500).json({
          message: 'Falha ao fazer upload do comprovante para o Cloudinary.'
        });
      }
    } else {
      next(); // Continua se não houver arquivo (texto pode ser usado como comprovante)
    }
  });
};


/**
 * @desc Middleware para upload de Vídeo.
 * @route POST /admin/videos (com upload)
 */
exports.uploadVideo = (req, res, next) => {
  upload.single('video')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer error (uploadVideo):', err);
      return res.status(400).json({
        message: 'Erro no upload do vídeo: ' + err.message
      });
    } else if (err) {
      console.error('Erro desconhecido no upload do vídeo:', err);
      return res.status(500).json({
        message: 'Erro interno do servidor ao fazer upload do vídeo.'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: 'Nenhum arquivo de vídeo enviado.'
      });
    }

    try {
      const result = await exports.uploadToCloudinary(req.file.buffer, 'veed_videos', 'video');
      req.file.path = result.secure_url; // Armazena o URL do Cloudinary no req.file.path para o controller
      next();
    } catch (cloudinaryErr) {
      console.error('Erro no upload do vídeo para o Cloudinary:', cloudinaryErr);
      return res.status(500).json({
        message: 'Falha ao fazer upload do vídeo para o Cloudinary.'
      });
    }
  });
};


// --- Outras Funções Auxiliares ---

/**
 * @desc Gera um código de referência único.
 * @returns {string} - Um código de referência alfanumérico único.
 */
exports.generateReferralCode = () => {
  return uuidv4().substring(0, 8).replace(/-/g, '').toUpperCase(); // Gera um UUID e pega 8 caracteres
};