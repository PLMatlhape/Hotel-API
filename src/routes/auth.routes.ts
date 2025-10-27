import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { registerValidator, loginValidator } from '../utils/validators.js';

const router = Router();

// =============================================
// PUBLIC ROUTES
// =============================================

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post(
  '/register',
  registerValidator,
  validate,
  authController.register
);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post(
  '/login',
  loginValidator,
  validate,
  authController.login
);

// =============================================
// PROTECTED ROUTES
// =============================================

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get(
  '/me',
  protect,
  authController.getCurrentUser
);

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post(
  '/logout',
  protect,
  authController.logout
);

export default router;