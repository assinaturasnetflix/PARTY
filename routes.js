// routes.js
const express = require('express');
const router = express.Router();

// Importar os controladores (iremos criá-los a seguir)
const userController = require('./controllers'); // Iremos exportar as funções de controllers neste objeto
const adminController = require('./controllers');
const videoController = require('./controllers');
const depositController = require('./controllers');
const withdrawalController = require('./controllers');
const authMiddleware = require('./utils'); // Para verificação de token JWT e isAdmin
const uploadMiddleware = require('./utils'); // Para upload de arquivos com Multer e Cloudinary

// --- Rotas de Autenticação e Usuário ---
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);
router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password/:token', userController.resetPassword);

// Rotas protegidas por autenticação (requerem um token JWT válido)
router.use(authMiddleware.authenticateToken); // Todas as rotas abaixo desta linha exigirão autenticação

router.get('/profile', userController.getUserProfile);
router.put('/profile', uploadMiddleware.uploadAvatar, userController.updateUserProfile); // Com upload de avatar
router.put('/change-password', userController.changePassword);
router.get('/wallet', userController.getWalletDetails);
router.get('/transactions', userController.getUserTransactions);
router.get('/daily-videos', userController.getDailyVideos);
router.post('/watch-video/:videoId', userController.watchVideo); // Marcar vídeo como assistido
router.get('/referrals', userController.getReferralInfo);


// --- Rotas de Depósito ---
router.post('/deposit', uploadMiddleware.uploadProof, depositController.requestDeposit); // Com upload de comprovante
router.get('/deposits/user', depositController.getUserDeposits); // Histórico de depósitos do usuário

// --- Rotas de Levantamento (Saque) ---
router.post('/withdraw', withdrawalController.requestWithdrawal);
router.get('/withdrawals/user', withdrawalController.getUserWithdrawals); // Histórico de levantamentos do usuário

// --- Rotas de Planos (usuário) ---
router.get('/plans', userController.getAllPlans);
router.post('/plan/purchase', userController.purchasePlan);


// --- Rotas do Administrador (protegidas por autenticação e verificação de isAdmin) ---
router.use(authMiddleware.authorizeAdmin); // Todas as rotas abaixo desta linha exigirão que o usuário seja admin

router.post('/admin/plans', adminController.createPlan);
router.put('/admin/plans/:planId', adminController.updatePlan);
router.delete('/admin/plans/:planId', adminController.deletePlan);

router.post('/admin/videos', uploadMiddleware.uploadVideo, adminController.addVideo); // Com upload de vídeo
router.put('/admin/videos/:videoId', adminController.updateVideo);
router.delete('/admin/videos/:videoId', adminController.deleteVideo);
router.get('/admin/videos', adminController.getAllVideos); // Listar todos os vídeos

router.get('/admin/deposits/pending', adminController.getPendingDeposits);
router.put('/admin/deposits/:depositId/approve', adminController.approveDeposit);
router.put('/admin/deposits/:depositId/reject', adminController.rejectDeposit);

router.get('/admin/withdrawals/pending', adminController.getPendingWithdrawals);
router.put('/admin/withdrawals/:withdrawalId/approve', adminController.approveWithdrawal);
router.put('/admin/withdrawals/:withdrawalId/reject', adminController.rejectWithdrawal);

router.get('/admin/users', adminController.getAllUsers);
router.get('/admin/users/:userId', adminController.getUserDetails);
router.put('/admin/users/:userId/block', adminController.blockUser);
router.put('/admin/users/:userId/unblock', adminController.unblockUser);
router.post('/admin/users/:userId/add-balance', adminController.addBalanceToUser);
router.post('/admin/users/:userId/remove-balance', adminController.removeBalanceFromUser);
router.get('/admin/dashboard-stats', adminController.getDashboardStats); // Estatísticas gerais do painel

module.exports = router;