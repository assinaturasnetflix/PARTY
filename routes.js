// routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Importa todos os controladores
const {
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
} = require('./controllers');

// Configuração do Multer para upload de arquivos temporários
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Salva temporariamente na pasta 'uploads'
    },
    filename: (req, file, cb) => {
        cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    },
});

const upload = multer({ storage: storage });

// --- Rotas de Autenticação e Usuário ---
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Rotas protegidas (requerem token JWT)
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.post('/profile/avatar', protect, upload.single('avatar'), uploadUserAvatar); // Upload de avatar

// --- Rotas de Planos ---
router.get('/plans', getAllPlans); // Qualquer usuário pode ver os planos
router.post('/plans/purchase', protect, purchasePlan); // Comprar plano

// --- Rotas de Vídeos ---
router.get('/videos/daily', protect, getDailyVideos); // Obter vídeos diários do usuário
router.post('/videos/watch', protect, markVideoAsWatched); // Marcar vídeo como assistido e recompensar

// --- Rotas de Depósito ---
router.post('/deposits/request', protect, requestDeposit);
router.post('/deposits/proof-upload', protect, upload.single('proof'), uploadDepositProof); // Upload de comprovante
router.get('/deposits/history', protect, getUserDeposits); // Histórico de depósitos do usuário
router.get('/admin/mpesa-number', protect, getAdminMpesaNumber); // Obter número M-Pesa do admin para depósitos

// --- Rotas de Levantamento ---
router.post('/withdrawals/request', protect, requestWithdrawal);
router.get('/withdrawals/history', protect, getUserWithdrawals); // Histórico de levantamentos do usuário

// --- Rotas do Painel Administrativo (Requerem 'admin' middleware) ---

// Usuários
router.get('/admin/users', protect, admin, getAllUsers);
router.put('/admin/users/:userId/toggle-active', protect, admin, toggleUserActiveStatus); // Bloquear/Desbloquear
router.put('/admin/users/:userId/adjust-balance', protect, admin, adjustUserBalance); // Ajustar saldo manualmente

// Planos
router.post('/admin/plans', protect, admin, createPlan); // Criar plano

// Vídeos
router.post('/admin/videos', protect, admin, upload.single('videoFile'), addVideo); // Adicionar vídeo (suporta upload de arquivo)
router.get('/admin/videos', protect, admin, getAllVideos);
router.delete('/admin/videos/:videoId', protect, admin, deleteVideo);

// Depósitos
router.get('/admin/deposits', protect, admin, getAllDeposits);
router.put('/admin/deposits/:depositId/status', protect, admin, updateDepositStatus); // Aprovar/Rejeitar depósito
router.post('/admin/settings/mpesa-number', protect, admin, setAdminMpesaNumber); // Configurar número M-Pesa do admin

// Levantamentos
router.get('/admin/withdrawals', protect, admin, getAllWithdrawals);
router.put('/admin/withdrawals/:withdrawalId/status', protect, admin, updateWithdrawalStatus); // Aprovar/Rejeitar levantamento

// Transações
router.get('/admin/transactions', protect, admin, getAllTransactions);
router.get('/admin/users/:userId/transactions', protect, admin, getUserTransactions);


module.exports = router;