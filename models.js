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
        url: { type: String, default: '' },
        cloudinary_id: { type: String, default: '' }
    },

    // Carteira e Plano
    balance: {
        type: Number,
        default: 50.00
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
        default: () => crypto.randomBytes(6).toString('hex').slice(0, 8)
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
        type: Date,
        default: null
    },
    fullWatchedHistory: [{
        type: Schema.Types.ObjectId,
        ref: 'Video'
    }],

    // Campo para identificar administradores
    isAdmin: {
        type: Boolean,
        default: false
    },

    // Status e Segurança
    isBlocked: {
        type: Boolean,
        default: false
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,

}, { timestamps: true });

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
    cost: {
        type: Number,
        required: true
    },
    dailyVideoLimit: {
        type: Number,
        required: true
    },
    durationInDays: {
        type: Number,
        required: true
    },
    rewardPerVideo: {
        type: Number,
        required: true
    },
    totalReward: {
        type: Number,
        required: true
    },
    isActive: {
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
    url: {
        type: String,
        required: true
    },
    cloudinary_id: {
        type: String,
        required: true
    },
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
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: [
            'signup_bonus',
            'deposit',
            'plan_purchase',
            'daily_reward',
            'referral_plan',
            'referral_daily',
            'withdrawal',
            'admin_credit',
            'admin_debit'
        ],
        required: true
    },
    description: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'cancelled'],
        default: 'completed'
    },
    referenceId: {
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
    proof: {
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
    adminNotes: {
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
    phoneNumber: {
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
// 7. ESQUEMA DE CONFIGURAÇÕES (Settings) - ATUALIZADO
// ----------------------------------------
const settingsSchema = new Schema({
    singletonId: {
        type: String,
        default: 'main_settings',
        unique: true
    },
    // Os campos de depósito foram movidos para o novo modelo PaymentMethod
    // Outras configurações futuras da plataforma podem ser adicionadas aqui.
}, { timestamps: true });

const Settings = mongoose.model('Settings', settingsSchema);

// ----------------------------------------
// 8. NOVO ESQUEMA: MÉTODOS DE PAGAMENTO (PaymentMethod)
// ----------------------------------------
const paymentMethodSchema = new Schema({
    name: { // Ex: "M-Pesa", "e-Mola", "BCI Transferência"
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    details: { // Ex: O número de telefone "84 123 4567", o NIB, etc.
        type: String,
        required: true,
        trim: true
    },
    instructions: { // Ex: "Envie para o NIB...", "Use a referência...", pode estar em branco
        type: String,
        trim: true
    },
    type: { // Define se o método é para Depósito, Levantamento ou ambos
        type: String,
        enum: ['deposit', 'withdrawal', 'both'],
        required: true
    },
    isActive: { // O admin pode ativar ou desativar este método
        type: Boolean,
        default: true
    }
}, { timestamps: true });

const PaymentMethod = mongoose.model('PaymentMethod', paymentMethodSchema);

// ----------------------------------------
// EXPORTAÇÃO DE TODOS OS MODELOS
// ----------------------------------------
module.exports = {
    User,
    Plan,
    Video,
    Transaction,
    Deposit,
    Withdrawal,
    Settings,
    PaymentMethod // Adicionado o novo modelo
};