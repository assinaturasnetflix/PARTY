// routes.js (VERSÃO CORRETA)

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { imageStorage, videoStorage } = require('./utils');
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
    adminFinanceController
} = require('./controllers');
const { protect, admin } = require('./middleware');

const uploadImage = multer({ storage: imageStorage });
const uploadVideo = multer({ storage: videoStorage });

router.post('/auth/register', authController.registerUser);
router.post('/auth/login', authController.loginUser);
router.post('/auth/forgot-password', authController.forgotPassword);
router.put('/auth/reset-password/:resetToken', authController.resetPassword);
router.get('/plans', planController.getAllActivePlans);
router.get('/user/me', protect, userController.getUserProfile);
router.put('/user/update-details', protect, userController.updateUserDetails);
router.put('/user/update-password', protect, userController.updateUserPassword);
router.post('/user/avatar', protect, uploadImage.single('avatar'), userController.uploadAvatar);
router.get('/videos/daily', protect, videoController.getDailyVideos);
router.post('/videos/watch/:videoId', protect, videoController.markVideoAsWatched);
router.post('/plans/buy/:planId', protect, planController.buyPlan);
router.get('/wallet', protect, walletController.getWalletDetails);
router.post('/wallet/deposit', protect, uploadImage.single('proofImage'), walletController.requestDeposit);
router.post('/wallet/withdraw', protect, walletController.requestWithdrawal);
router.get('/referrals', protect, referralController.getReferralData);
router.get('/admin/stats', protect, admin, adminDashboardController.getDashboardStats);
router.get('/admin/users', protect, admin, adminUserController.getAllUsers);
router.get('/admin/users/:userId', protect, admin, adminUserController.getUserById);
router.put('/admin/users/:userId/toggle-block', protect, admin, adminUserController.toggleBlockUser);
router.post('/admin/users/:userId/manual-balance', protect, admin, adminUserController.manualBalanceUpdate);
router.post('/admin/plans', protect, admin, adminPlanController.createPlan);
router.get('/admin/plans/all', protect, admin, adminPlanController.getAllPlans);
router.put('/admin/plans/:planId', protect, admin, adminPlanController.updatePlan);
router.delete('/admin/plans/:planId', protect, admin, adminPlanController.deletePlan);
router.post('/admin/videos/upload', protect, admin, uploadVideo.single('video'), adminVideoController.uploadVideo);
router.get('/admin/videos', protect, admin, adminVideoController.getAllVideos);
router.delete('/admin/videos/:videoId', protect, admin, adminVideoController.deleteVideo);
router.get('/admin/deposits', protect, admin, adminFinanceController.getDeposits);
router.put('/admin/deposits/:depositId/approve', protect, admin, adminFinanceController.approveDeposit);
router.put('/admin/deposits/:depositId/reject', protect, admin, adminFinanceController.rejectDeposit);
router.get('/admin/withdrawals', protect, admin, adminFinanceController.getWithdrawals);
router.put('/admin/withdrawals/:withdrawalId/approve', protect, admin, adminFinanceController.approveWithdrawal);
router.put('/admin/withdrawals/:withdrawalId/reject', protect, admin, adminFinanceController.rejectWithdrawal);

module.exports = router;