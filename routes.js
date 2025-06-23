// routes.js (ATUALIZADO)

const express = require('express');
const router = express.Router();
const multer = require('multer');

// Importação das configurações de armazenamento do Cloudinary
const { imageStorage, videoStorage } = require('./utils');

// Importação dos controllers
const {
    authController,
    userController,
    planController,
    videoController,
    walletController,
    referralController,
    adminDashboardController,
    adminUserController,
    adminPlanController,
    adminVideoController,
    adminFinanceController,
    settingsController, // Adicionado
    adminSettingsController // Adicionado
} = require('./controllers');

// Importação dos middlewares de autenticação
const { protect, admin } = require('./middleware');

// Configuração do Multer para upload de arquivos
const uploadImage = multer({ storage: imageStorage });
const uploadVideo = multer({ storage: videoStorage });

/*
==========================================================================================
                                      ROTAS PÚBLICAS
==========================================================================================
*/

// --- Autenticação ---
router.post('/auth/register', authController.registerUser);
router.post('/auth/login', authController.loginUser);
router.post('/auth/forgot-password', authController.forgotPassword);
router.put('/auth/reset-password/:resetToken', authController.resetPassword);

// --- Planos (visualização pública) ---
router.get('/plans', planController.getAllActivePlans);

// --- NOVO: Rota pública para obter configurações (números de depósito, etc) ---
router.get('/settings', settingsController.getSettings);


/*
==========================================================================================
                                ROTAS PROTEGIDAS (USUÁRIO LOGADO)
==========================================================================================
*/

// --- Perfil do Usuário ---
router.get('/user/me', protect, userController.getUserProfile);
router.put('/user/update-details', protect, userController.updateUserDetails);
router.put('/user/update-password', protect, userController.updateUserPassword);
router.post('/user/avatar', protect, uploadImage.single('avatar'), userController.uploadAvatar);

// --- Vídeos ---
router.get('/videos/daily', protect, videoController.getDailyVideos);
router.post('/videos/watch/:videoId', protect, videoController.markVideoAsWatched);

// --- Compra de Planos ---
router.post('/plans/buy/:planId', protect, planController.buyPlan);

// --- Carteira e Transações ---
router.get('/wallet', protect, walletController.getWalletDetails);
router.post('/wallet/deposit', protect, uploadImage.single('proofImage'), walletController.requestDeposit);
router.post('/wallet/withdraw', protect, walletController.requestWithdrawal);

// --- Sistema de Referência ---
router.get('/referrals', protect, referralController.getReferralData);


/*
==========================================================================================
                                ROTAS DE ADMINISTRADOR (ADMIN)
==========================================================================================
*/

// --- Painel de Controle (Dashboard) ---
router.get('/admin/stats', protect, admin, adminDashboardController.getDashboardStats);

// --- Gerenciamento de Usuários (Admin) ---
router.get('/admin/users', protect, admin, adminUserController.getAllUsers);
router.get('/admin/users/:userId', protect, admin, adminUserController.getUserById);
router.put('/admin/users/:userId/toggle-block', protect, admin, adminUserController.toggleBlockUser);
router.post('/admin/users/:userId/manual-balance', protect, admin, adminUserController.manualBalanceUpdate);

// --- Gerenciamento de Planos (Admin) ---
router.post('/admin/plans', protect, admin, adminPlanController.createPlan);
router.get('/admin/plans/all', protect, admin, adminPlanController.getAllPlans);
router.put('/admin/plans/:planId', protect, admin, adminPlanController.updatePlan);
router.delete('/admin/plans/:planId', protect, admin, adminPlanController.deletePlan);

// --- Gerenciamento de Vídeos (Admin) ---
router.post('/admin/videos/upload', protect, admin, uploadVideo.single('video'), adminVideoController.uploadVideo);
router.get('/admin/videos', protect, admin, adminVideoController.getAllVideos);
router.delete('/admin/videos/:videoId', protect, admin, adminVideoController.deleteVideo);

// --- Gerenciamento Financeiro (Admin) ---
router.get('/admin/deposits', protect, admin, adminFinanceController.getDeposits);
router.put('/admin/deposits/:depositId/approve', protect, admin, adminFinanceController.approveDeposit);
router.put('/admin/deposits/:depositId/reject', protect, admin, adminFinanceController.rejectDeposit);
router.get('/admin/withdrawals', protect, admin, adminFinanceController.getWithdrawals);
router.put('/admin/withdrawals/:withdrawalId/approve', protect, admin, adminFinanceController.approveWithdrawal);
router.put('/admin/withdrawals/:withdrawalId/reject', protect, admin, adminFinanceController.rejectWithdrawal);

// --- NOVO: Rotas de Admin para gerir as configurações ---
router.get('/admin/settings', protect, admin, settingsController.getSettings);
router.put('/admin/settings', protect, admin, adminSettingsController.updateSettings);


module.exports = router;