import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// =============================================
// PROTECTED ROUTES
// =============================================

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', protect, userController.getUserProfile);

// @route   PUT /api/users/profile
// @desc    Update current user profile
// @access  Private
router.put('/profile', protect, userController.updateUserProfile);

// @route   PUT /api/users/password
// @desc    Update current user password
// @access  Private
router.put('/password', protect, userController.updateUserPassword);

// @route   DELETE /api/users/account
// @desc    Delete current user account
// @access  Private
router.delete('/account', protect, userController.deleteUserAccount);

// @route   GET /api/users/me
// @desc    Get current user (alias for /profile)
// @access  Private
router.get('/me', protect, userController.getUserProfile);

export default router;
