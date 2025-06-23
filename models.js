// models.js

const mongoose = require('mongoose');
const { Schema } = mongoose;
const crypto = require('crypto');

// ----------------------------------------
// 1. ESQUEMA DO USUÁRIO (User)
// ----------------------------------------
const userSchema = new Schema({
    // Informações básicas
    username: {
        type: String,
        required: [true, 'O nome de usuário é obrigatório.'],
        unique: true,
        trim: true,
        index: true
    },
    email: {
        type: String,
        required: [true, 'O e-mail é obrigatório.'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/\S+@\S+\.\S+/, 'Por favor, insira um endereço de e-mail válido.']
    },
    password: {
        type: String,
        required: [true, 'A senha é obrigatória.']
    },
    avatar: {
        url: { type: String, default: '' }, // URL da imagem no Cloudinary
        cloudinary_id: { type: String, default: '' }
    },

    // Carteira e Plano
    balance: {
        type: Number,
        default: 50.00 // Bônus de cadastro de 50MT
    },
    activePlan: {
        planId: { type: Schema.Types.ObjectId, ref: 'Plan', default: null },
        name: { type: String, default: '' },
        activationDate: { type: Date },
        expiryDate: { type: Date }
    },

    // Sistema de Referência
    referralCode: {
        type: String,
        unique: true,
        required: true,
        default: () => crypto.randomBytes(6).toString('hex').slice(0, 8) // Gera um código de 8 caracteres
    },
    referredBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    // Controle de Vídeos Assistidos
    dailyWatchedVideos: [{
        videoId: { type: Schema.Types.ObjectId, ref: 'Video' },
        date: { type: Date, default: Date.now }
    }],
    lastVideoReset: {
        type: Date, // Armazena a data do último reset para controle diário
        default: null
    },
    fullWatchedHistory: [{
        type: Schema.Types.ObjectId,
        ref: 'Video'
    }],


    // Status e Segurança
    isBlocked: {
        type: Boolean,
        default: false
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,

}, { timestamps: true }); // Adiciona createdAt e updatedAt automaticamente

const User = mongoose.model('User', userSchema);

// ----------------------------------------
// 2. ESQUEMA DO PLANO (Plan)
// ----------------------------------------
const planSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    cost: { // Preço do plano em MT
        type: Number,
        required: true
    },
    dailyVideoLimit: { // Quantidade de vídeos por dia
        type: Number,
        required: true
    },
    durationInDays: { // Duração do plano em dias
        type: Number,
        required: true
    },
    rewardPerVideo: { // Recompensa por cada vídeo assistido
        type: Number,
        required: true
    },
    totalReward: { // Recompensa total (calculada ou inserida)
        type: Number,
        required: true
    },
    isActive: { // Para o admin poder desativar um plano
        type: Boolean,
        default: true
    }
}, { timestamps: true });

const Plan = mongoose.model('Plan', planSchema);

// ----------------------------------------
// 3. ESQUEMA DO VÍDEO (Video)
// ----------------------------------------
const videoSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    url: { // URL do vídeo no Cloudinary
        type: String,
        required: true
    },
    cloudinary_id: {
        type: String,
        required: true
    },
    // O uploader seria o admin que adicionou
    uploader: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

const Video = mongoose.model('Video', videoSchema);

// ----------------------------------------
// 4. ESQUEMA DE TRANSAÇÃO (Transaction)
// ----------------------------------------
const transactionSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    amount: { // Pode ser positivo (ganho) ou negativo (gasto)
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: [
            'signup_bonus',     // Bônus de cadastro
            'deposit',          // Depósito aprovado
            'plan_purchase',    // Compra de plano
            'daily_reward',     // Recompensa por assistir vídeo
            'referral_plan',    // Bônus de 10% pela compra do plano do indicado
            'referral_daily',   // Bônus de 5% sobre o ganho diário do indicado
            'withdrawal',       // Levantamento solicitado (valor fica negativo)
            'admin_credit',     // Saldo adicionado pelo admin
            'admin_debit'       // Saldo removido pelo admin
        ],
        required: true
    },
    description: {
        type: String,
        required: true
    },
    status: { // Útil para levantamentos
        type: String,
        enum: ['pending', 'completed', 'cancelled'],
        default: 'completed'
    },
    referenceId: { // ID do documento relacionado (depósito, levantamento, usuário indicado)
        type: Schema.Types.ObjectId,
    }
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

// ----------------------------------------
// 5. ESQUEMA DE DEPÓSITO (Deposit)
// ----------------------------------------
const depositSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['M-Pesa', 'e-Mola'],
        required: true
    },
    proof: { // Pode ser o texto da mensagem ou a URL da imagem do comprovativo
        text: String,
        imageUrl: String,
        imageCloudinaryId: String
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        index: true
    },
    adminNotes: { // Razão da rejeição, por exemplo
        type: String
    }
}, { timestamps: true });

const Deposit = mongoose.model('Deposit', depositSchema);

// ----------------------------------------
// 6. ESQUEMA DE LEVANTAMENTO (Withdrawal)
// ----------------------------------------
const withdrawalSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['M-Pesa', 'e-Mola'],
        required: true
    },
    phoneNumber: { // Número para onde o valor deve ser enviado
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        index: true
    },
    adminNotes: {
        type: String
    }
}, { timestamps: true });

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

// ----------------------------------------
// EXPORTAÇÃO DE TODOS OS MODELOS
// ----------------------------------------
module.exports = {
    User,
    Plan,
    Video,
    Transaction,
    Deposit,
    Withdrawal
};