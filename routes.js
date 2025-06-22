// routes.js
const express = require('express');
const router = express.Router();
const controllers = require('./controllers');
const { authenticateToken, authorizeAdmin } = require('./utils');
const { upload } = require('./server'); // Importa o multer configurado do server.js

// --- Rotas de Autenticação e Usuário ---

// Cadastro de usuário
router.post('/auth/register', controllers.registerUser);

// Login de usuário
router.post('/auth/login', controllers.loginUser);

// Solicitar redefinição de senha
router.post('/auth/request-password-reset', controllers.requestPasswordReset);

// Redefinir senha
router.post('/auth/reset-password', controllers.resetPassword);

// Obter perfil do usuário (requer autenticação)
router.get('/user/profile', authenticateToken, controllers.getUserProfile);

// Atualizar perfil do usuário (requer autenticação)
router.put('/user/profile', authenticateToken, controllers.updateProfile);

// Alterar senha do usuário (requer autenticação)
router.put('/user/change-password', authenticateToken, controllers.changePassword);

// Upload de avatar do usuário (requer autenticação)
// 'avatar' é o nome do campo no formulário que conterá o arquivo
router.post('/user/avatar', authenticateToken, upload.single('avatar'), controllers.uploadAvatar);


// --- Rotas de Planos ---

// Criar plano (apenas admin)
router.post('/admin/plans', authenticateToken, authorizeAdmin, controllers.createPlan);

// Listar todos os planos
router.get('/plans', controllers.listPlans);

// Comprar plano (requer autenticação)
router.post('/plans/purchase', authenticateToken, controllers.purchasePlan);


// --- Rotas de Vídeos ---

// Adicionar vídeo (apenas admin)
// 'videoFile' é o nome do campo no formulário que conterá o arquivo (se for upload local)
router.post('/admin/videos', authenticateToken, authorizeAdmin, upload.single('videoFile'), controllers.addVideo);

// Listar todos os vídeos (apenas admin)
router.get('/admin/videos', authenticateToken, authorizeAdmin, controllers.listAllVideos);

// Obter vídeos do dia para o usuário (requer autenticação)
router.get('/videos/daily', authenticateToken, controllers.getDailyVideos);

// Marcar vídeo como assistido e creditar recompensa (requer autenticação)
router.post('/videos/watch', authenticateToken, controllers.markVideoAsWatched);


// --- Rotas de Depósito ---

// Solicitar depósito (requer autenticação)
// 'proof' é o campo para o comprovante (imagem ou texto)
router.post('/deposits/request', authenticateToken, controllers.requestDeposit);

// Listar depósitos pendentes (apenas admin)
router.get('/admin/deposits/pending', authenticateToken, authorizeAdmin, controllers.listPendingDeposits);

// Aprovar/Rejeitar depósito (apenas admin)
router.put('/admin/deposits/:depositId/status', authenticateToken, authorizeAdmin, controllers.updateDepositStatus);


// --- Rotas de Levantamento (Saque) ---

// Solicitar levantamento (requer autenticação)
router.post('/withdrawals/request', authenticateToken, controllers.requestWithdrawal);

// Listar levantamentos pendentes (apenas admin)
router.get('/admin/withdrawals/pending', authenticateToken, authorizeAdmin, controllers.listPendingWithdrawals);

// Aprovar/Rejeitar levantamento (apenas admin)
router.put('/admin/withdrawals/:withdrawalId/status', authenticateToken, authorizeAdmin, controllers.updateWithdrawalStatus);


// --- Rotas de Referência ---

// Obter dados de referência do usuário (requer autenticação)
router.get('/user/referrals', authenticateToken, controllers.getUserReferrals);


// --- Rotas de Admin (Painel de Controle) ---

// Listar todos os usuários (apenas admin)
router.get('/admin/users', authenticateToken, authorizeAdmin, controllers.listAllUsers);

// Bloquear/Desbloquear usuário (apenas admin)
router.put('/admin/users/:userId/toggle-active', authenticateToken, authorizeAdmin, controllers.toggleUserActiveStatus);

// Ajustar saldo do usuário manualmente (apenas admin)
router.put('/admin/users/:userId/adjust-balance', authenticateToken, authorizeAdmin, controllers.adjustUserBalance);

// Listar todas as transações (apenas admin)
router.get('/admin/transactions', authenticateToken, authorizeAdmin, controllers.getAllTransactions);


// --- Rotas de Carteira e Histórico ---

// Obter histórico de transações do usuário (requer autenticação)
router.get('/user/transactions', authenticateToken, controllers.getUserTransactions);


module.exports = router;