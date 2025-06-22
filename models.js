// models.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

// Esquema do Usuário
const userSchema = new Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatar: { type: String, default: '' }, // URL do Cloudinary para o avatar
    balance: { type: Number, default: 50 }, // Bônus inicial de 50 MT
    referralCode: { type: String, unique: true },
    referredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    currentPlan: { type: Schema.Types.ObjectId, ref: 'Plan' },
    planExpiresAt: { type: Date },
    videosWatchedToday: [{
        videoId: { type: Schema.Types.ObjectId, ref: 'Video' },
        watchedAt: { type: Date, default: Date.now }
    }],
    dailyRewardClaimedAt: { type: Date }, // Para controlar a recompensa diária
    isAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true } // Para bloquear/desbloquear usuários
}, { timestamps: true });

// Esquema do Plano
const planSchema = new Schema({
    name: { type: String, required: true, unique: true },
    value: { type: Number, required: true }, // Custo do plano
    videosPerDay: { type: Number, required: true },
    durationDays: { type: Number, required: true },
    dailyReward: { type: Number, required: true }, // Recompensa por vídeo assistido (valor do plano / (videosPerDay * durationDays))
    totalReturn: { type: Number, required: true } // Valor total que o usuário pode ganhar
}, { timestamps: true });

// Esquema do Vídeo
const videoSchema = new Schema({
    title: { type: String, required: true },
    url: { type: String, required: true }, // URL do vídeo (Cloudinary ou externa)
    description: { type: String },
    isAvailable: { type: Boolean, default: true } // Para ativar/desativar vídeos
}, { timestamps: true });

// Esquema do Depósito
const depositSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    proof: { type: String, required: true }, // URL da imagem do comprovante ou texto
    method: { type: String, enum: ['M-Pesa', 'e-Mola'], required: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' }, // Admin que aprovou
    approvedAt: { type: Date }
}, { timestamps: true });

// Esquema do Levantamento (Saque)
const withdrawalSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['M-Pesa', 'e-Mola'], required: true },
    accountNumber: { type: String, required: true }, // Número para onde enviar o dinheiro
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User' }, // Admin que processou
    processedAt: { type: Date }
}, { timestamps: true });

// Esquema da Transação (para histórico geral na carteira)
const transactionSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['Deposit', 'Withdrawal', 'Plan Purchase', 'Daily Reward', 'Referral Bonus', 'Sign-up Bonus'], required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['Completed', 'Pending', 'Failed'], default: 'Completed' },
    relatedTo: { type: Schema.Types.ObjectId, refPath: 'relatedModel' }, // Referência ao documento relacionado (Deposit, Withdrawal, Plan)
    relatedModel: { type: String, enum: ['Deposit', 'Withdrawal', 'Plan'], required: function() { return ['Deposit', 'Withdrawal', 'Plan Purchase'].includes(this.type); } },
    description: { type: String }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Plan = mongoose.model('Plan', planSchema);
const Video = mongoose.model('Video', videoSchema);
const Deposit = mongoose.model('Deposit', depositSchema);
const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = {
    User,
    Plan,
    Video,
    Deposit,
    Withdrawal,
    Transaction
};
