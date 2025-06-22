// models.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// --- User Model ---
const userSchema = new Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    avatar: { type: String, default: '' }, // URL do Cloudinary para o avatar
    balance: { type: Number, default: 0 },
    referralCode: { type: String, unique: true },
    referredBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    dailyVideosWatched: [{
        videoId: { type: Schema.Types.ObjectId, ref: 'Video' },
        watchedAt: { type: Date, default: Date.now }
    }],
    lastRewardClaimDate: { type: Date, default: null }, // Para controlar a atualização diária de recompensas
    currentPlan: { type: Schema.Types.ObjectId, ref: 'Plan', default: null },
    planActivationDate: { type: Date, default: null },
    videosWatchedTodayCount: { type: Number, default: 0 },
    // Adicionar um campo para rastrear os IDs dos vídeos já assistidos por este usuário
    // Útil para garantir que vídeos não se repitam dentro do ciclo do plano
    watchedVideosHistory: [{
        videoId: { type: Schema.Types.ObjectId, ref: 'Video' },
        watchedOn: { type: Date, required: true }
    }],
    isActive: { type: Boolean, default: true }, // Para bloquear/desbloquear usuários
}, { timestamps: true });

// --- Plan Model ---
const planSchema = new Schema({
    name: { type: String, required: true, unique: true },
    value: { type: Number, required: true }, // Custo do plano em MT
    videosPerDay: { type: Number, required: true },
    durationDays: { type: Number, required: true },
    totalReward: { type: Number, required: true }, // Recompensa total que o usuário ganha ao fim do plano
    dailyReward: { type: Number, required: true } // Recompensa por dia
}, { timestamps: true });

// --- Video Model ---
const videoSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String },
    url: { type: String, required: true }, // URL do vídeo (Cloudinary ou externa)
    duration: { type: Number, required: true }, // Duração do vídeo em segundos
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // Pode ser um admin
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

// --- Deposit Model ---
const depositSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    mpesaNumber: { type: String }, // Número M-Pesa/e-Mola do usuário
    transactionId: { type: String }, // ID da transação se houver
    proof: { type: String, required: true }, // URL do comprovante (imagem ou texto)
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // Admin que aprovou
    approvedAt: { type: Date },
}, { timestamps: true });

// --- Withdrawal Model ---
const withdrawalSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    mpesaNumber: { type: String, required: true }, // Número M-Pesa/e-Mola para onde o dinheiro será enviado
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date },
}, { timestamps: true });

// --- Transaction Model (para registrar todas as movimentações de saldo) ---
const transactionSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['deposit', 'withdrawal', 'video_reward', 'referral_plan_bonus', 'referral_daily_bonus', 'plan_purchase', 'manual_adjustment'], required: true },
    amount: { type: Number, required: true },
    description: { type: String },
    relatedId: { type: Schema.Types.ObjectId, default: null }, // ID do depósito, retirada, plano, etc.
}, { timestamps: true });

// --- Admin Settings Model (para guardar configurações do admin, como números M-Pesa para depósito) ---
const adminSettingsSchema = new Schema({
    settingName: { type: String, required: true, unique: true },
    settingValue: { type: String, required: true },
    description: { type: String }
}, { timestamps: true });


module.exports = {
    User: mongoose.model('User', userSchema),
    Plan: mongoose.model('Plan', planSchema),
    Video: mongoose.model('Video', videoSchema),
    Deposit: mongoose.model('Deposit', depositSchema),
    Withdrawal: mongoose.model('Withdrawal', withdrawalSchema),
    Transaction: mongoose.model('Transaction', transactionSchema),
    AdminSettings: mongoose.model('AdminSettings', adminSettingsSchema)
};