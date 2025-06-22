// models.js
const mongoose = require('mongoose');

// Esquema para o Usuário
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  balance: {
    type: Number,
    default: 50 // Bônus de 50MT ao se cadastrar
  },
  referralCode: {
    type: String,
    unique: true,
    required: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  activePlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    default: null
  },
  videosWatchedToday: {
    type: [mongoose.Schema.Types.ObjectId], // IDs dos vídeos assistidos hoje
    default: []
  },
  lastVideoWatchDate: {
    type: Date,
    default: null
  },
  totalVideosWatched: {
    type: Number,
    default: 0
  },
  avatar: {
    type: String, // URL do Cloudinary para a imagem do avatar
    default: null // Padrão será nulo/preto se não houver upload
  },
  isAdmin: {
    type: Boolean,
    default: false
  }
}, { timestamps: true }); // Adiciona createdAt e updatedAt automaticamente

// Esquema para os Planos de Investimento
const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  value: { // Custo do plano
    type: Number,
    required: true
  },
  rewardPerVideo: { // Recompensa por vídeo assistido (calculado a partir da recompensa total e vídeos/dia)
    type: Number,
    required: true
  },
  videosPerDay: {
    type: Number,
    required: true
  },
  duration: { // Duração do plano em dias
    type: Number,
    required: true
  },
  totalReward: { // Recompensa total que o plano oferece (valor * vídeos/dia * duração)
    type: Number,
    required: true
  }
}, { timestamps: true });

// Esquema para os Vídeos
const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  videoUrl: {
    type: String, // URL do Cloudinary para o vídeo
    required: true
  },
  duration: { // Duração do vídeo em segundos
    type: Number,
    required: true
  },
  uploadDate: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Esquema para Depósitos
const depositSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String, // 'M-Pesa' ou 'e-Mola'
    required: true
  },
  proof: { // URL do Cloudinary para a imagem do comprovante ou texto
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Admin que aprovou
    default: null
  },
  transactionId: { // Campo para armazenar o ID da transação no M-Pesa/e-Mola, se aplicável
    type: String,
    default: null
  }
}, { timestamps: true });

// Esquema para Levantamentos (Saques)
const withdrawalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String, // 'M-Pesa' ou 'e-Mola'
    required: true
  },
  phoneNumber: { // Número para onde o dinheiro será enviado
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Admin que processou
    default: null
  },
  transactionId: { // Campo para armazenar o ID da transação no M-Pesa/e-Mola, se aplicável
    type: String,
    default: null
  }
}, { timestamps: true });

// Esquema para Registro de Transações (histórico na carteira)
const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'plan_purchase', 'video_reward', 'referral_bonus_plan', 'referral_bonus_daily', 'signup_bonus'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: { // Para depósitos/levantamentos
    type: String,
    enum: ['pending', 'completed', 'failed', 'N/A'], // N/A para recompensas e bônus que são diretos
    default: 'N/A'
  },
  relatedEntity: { // Pode ser o ID de um depósito, levantamento, plano, etc.
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  description: {
    type: String,
    trim: true
  }
}, { timestamps: true });

// Esquema para registro de vídeos assistidos (para garantir que não se repitam no mesmo plano)
const userVideoHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  videoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
    required: true
  },
  planId: { // O plano sob o qual o vídeo foi assistido
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true
  },
  watchDate: {
    type: Date,
    required: true
  },
  isCompleted: { // Indica se o vídeo foi assistido até o fim para receber recompensa
    type: Boolean,
    default: false
  },
  rewardEarned: {
    type: Number,
    default: 0
  }
}, { timestamps: true });


// Exportar os modelos
module.exports = {
  User: mongoose.model('User', userSchema),
  Plan: mongoose.model('Plan', planSchema),
  Video: mongoose.model('Video', videoSchema),
  Deposit: mongoose.model('Deposit', depositSchema),
  Withdrawal: mongoose.model('Withdrawal', withdrawalSchema),
  Transaction: mongoose.model('Transaction', transactionSchema),
  UserVideoHistory: mongoose.model('UserVideoHistory', userVideoHistorySchema)
};