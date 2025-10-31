import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { paymentLimiter } from '../middleware/security.js';
import { validate } from '../middleware/validation.js';
import { createPaymentIntentValidator } from '../utils/validators.js';

const router = Router();

// =============================================
// PAYMENT ROUTES
// =============================================

// @route   POST /api/payments/intent
// @desc    Create payment intent
// @access  Private
router.post(
  '/intent',
  protect,
  paymentLimiter,
  createPaymentIntentValidator,
  validate,
  paymentController.createPaymentIntent
);

// @route   GET /api/payments/:paymentId/verify/:provider
// @desc    Verify payment status
// @access  Private
router.get(
  '/:paymentId/verify/:provider',
  protect,
  paymentController.verifyPayment
);

// @route   GET /api/payments/:paymentId
// @desc    Get payment by ID
// @access  Private
router.get(
  '/:paymentId',
  protect,
  paymentController.getPaymentById
);

// @route   GET /api/payments/user/me
// @desc    Get current user's payments
// @access  Private
router.get(
  '/user/me',
  protect,
  paymentController.getUserPayments
);

// =============================================
// WEBHOOK ROUTES (NO AUTH)
// =============================================

// @route   POST /api/payments/webhooks/stripe
// @desc    Handle Stripe webhook
// @access  Public (webhook)
router.post('/webhooks/stripe', paymentController.handleStripeWebhook);

// @route   POST /api/payments/webhooks/paypal
// @desc    Handle PayPal webhook
// @access  Public (webhook)
router.post('/webhooks/paypal', paymentController.handlePayPalWebhook);

// @route   POST /api/payments/webhooks/flutterwave
// @desc    Handle Flutterwave webhook
// @access  Public (webhook)
router.post('/webhooks/flutterwave', paymentController.handleFlutterwaveWebhook);

// =============================================
// ADMIN ROUTES
// =============================================

// @route   POST /api/payments/:paymentId/refund
// @desc    Refund payment (Admin only)
// @access  Private/Admin
router.post(
  '/:paymentId/refund',
  protect,
  restrictTo('admin'),
  paymentController.refundPayment
);

// @route   GET /api/payments/analytics
// @desc    Get payment analytics (Admin only)
// @access  Private/Admin
router.get(
  '/analytics',
  protect,
  restrictTo('admin'),
  paymentController.getPaymentAnalytics
);

export default router;
