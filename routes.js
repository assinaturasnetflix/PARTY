// routes.js

const express = require('express');
const router = express.Router();
const multer = require('multer');

// Importação das configurações de armazenamento do Cloudinary
const { imageStorage, videoStorage } = require('./utils');

// Importação dos controllers (que ainda vamos criar)
const authController = require('./controllers/authController');
const userController = require('./controllers/userController');
const planController = require('./controllers/planController');
const videoController = require('./controllers/videoController');
const walletController = require('./controllers/walletController');
const referralController = require('./controllers/referralController');

// Controllers do Admin
const adminDashboardController = require('./controllers/admin/dashboardController');
const adminUserController = require('./controllers/admin/userController');
const adminPlanController = require('./controllers/admin/planController');
const adminVideoController = require('./controllers/admin/videoController');
const adminFinanceController = require('./controllers/admin/financeController');

// Importação dos middlewares de autenticação (que também vamos criar)
const { protect, admin } = require('./middleware/authMiddleware');

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
router.post('/wallet/deposit', protect, uploadImage.single('proofImage'), walletController.requestDeposit); // 'proofImage' é o name do input no form
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
router.post('/admin/users/:userId/manual-balance', protect, admin, adminUserController.manualBalanceUpdate); // Adiciona ou remove saldo

// --- Gerenciamento de Planos (Admin) ---
router.post('/admin/plans', protect, admin, adminPlanController.createPlan);
router.get('/admin/plans/all', protect, admin, adminPlanController.getAllPlans); // Rota para admin ver todos, incluindo inativos
router.put('/admin/plans/:planId', protect, admin, adminPlanController.updatePlan);
router.delete('/admin/plans/:planId', protect, admin, adminPlanController.deletePlan);

// --- Gerenciamento de Vídeos (Admin) ---
router.post('/admin/videos/upload', protect, admin, uploadVideo.single('video'), adminVideoController.uploadVideo); // 'video' é o name do input no form
router.get('/admin/videos', protect, admin, adminVideoController.getAllVideos);
router.delete('/admin/videos/:videoId', protect, admin, adminVideoController.deleteVideo);

// --- Gerenciamento Financeiro (Admin) ---
router.get('/admin/deposits', protect, admin, adminFinanceController.getDeposits); // Pode filtrar por status (ex: /deposits?status=pending)
router.put('/admin/deposits/:depositId/approve', protect, admin, adminFinanceController.approveDeposit);
router.put('/admin/deposits/:depositId/reject', protect, admin, adminFinanceController.rejectDeposit);

router.get('/admin/withdrawals', protect, admin, adminFinanceController.getWithdrawals); // Pode filtrar por status
router.put('/admin/withdrawals/:withdrawalId/approve', protect, admin, adminFinanceController.approveWithdrawal);
router.put('/admin/withdrawals/:withdrawalId/reject', protect, admin, adminFinanceController.rejectWithdrawal);


module.exports = router;