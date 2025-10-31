import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import * as paymentService from '../services/payment.service.js';
import * as bookingService from '../services/booking.service.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { paymentLogger } from '../utils/logger.js';

// =============================================
// CREATE PAYMENT INTENT
// =============================================
export const createPaymentIntent = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;

    if (!userId) {
      return next(new AppError('Authentication required', 401));
    }

    const { bookingId, provider, currency = 'USD', metadata = {} } = req.body;

    // Validate required fields
    if (!bookingId) {
      return next(new AppError('Booking ID is required', 400));
    }

    if (!provider || !['stripe', 'paypal', 'flutterwave'].includes(provider)) {
      return next(new AppError('Valid payment provider is required (stripe, paypal, flutterwave)', 400));
    }

    // Verify booking belongs to user and get booking details
    const booking = await bookingService.getBookingById(bookingId);

    if (!booking) {
      return next(new AppError('Booking not found', 404));
    }

    if (booking.user_id !== userId) {
      return next(new AppError('You can only pay for your own bookings', 403));
    }

    if (booking.status !== 'confirmed') {
      return next(new AppError('Booking must be confirmed before payment', 400));
    }

    if (booking.payment_status === 'paid') {
      return next(new AppError('Booking is already paid for', 400));
    }

    try {
      // Create payment intent
      const paymentIntent = await paymentService.createPaymentIntent(
        userId,
        bookingId,
        provider,
        { ...metadata, currency }
      );

      paymentLogger.info('Payment intent created', {
        userId,
        bookingId,
        provider,
        amount: booking.total_amount,
        paymentIntentId: paymentIntent.id,
      });

      return res.status(201).json({
        success: true,
        message: 'Payment intent created successfully',
        data: paymentIntent,
      });
    } catch (error) {
      paymentLogger.error('Payment intent creation failed', {
        userId,
        bookingId,
        provider,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return next(new AppError('Failed to create payment intent', 500));
    }
  }
);

// =============================================
// VERIFY PAYMENT
// =============================================
export const verifyPayment = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { paymentId, provider } = req.params;

    if (!paymentId || !provider) {
      return next(new AppError('Payment ID and provider are required', 400));
    }

    try {
      const verificationResult = await paymentService.verifyPayment(paymentId, provider);

      paymentLogger.info('Payment verification completed', {
        paymentId,
        provider,
        status: verificationResult.status,
      });

      return res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        data: verificationResult,
      });
    } catch (error) {
      paymentLogger.error('Payment verification failed', {
        paymentId,
        provider,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return next(new AppError('Payment verification failed', 500));
    }
  }
);

// =============================================
// HANDLE STRIPE WEBHOOK
// =============================================
export const handleStripeWebhook = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      return next(new AppError('Missing Stripe signature', 400));
    }

    try {
      const result = await paymentService.handleStripeWebhook(req.body, signature);

      paymentLogger.info('Stripe webhook processed', {
        signature: signature?.slice(0, 20) + '...',
        received: result.received,
      });

      return res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
      });
    } catch (error) {
      paymentLogger.error('Stripe webhook processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return next(new AppError('Webhook processing failed', 400));
    }
  }
);

// =============================================
// HANDLE PAYPAL WEBHOOK
// =============================================
export const handlePayPalWebhook = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await paymentService.handlePayPalWebhook(req.body, req.headers);

      paymentLogger.info('PayPal webhook processed', {
        eventType: req.body?.event_type,
        received: result.received,
      });

      return res.status(200).json({
        success: true,
        message: 'PayPal webhook processed successfully',
      });
    } catch (error) {
      paymentLogger.error('PayPal webhook processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return next(new AppError('PayPal webhook processing failed', 400));
    }
  }
);

// =============================================
// HANDLE FLUTTERWAVE WEBHOOK
// =============================================
export const handleFlutterwaveWebhook = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const signature = req.headers['verif-hash'] as string;

    if (!signature) {
      return next(new AppError('Missing Flutterwave signature', 400));
    }

    try {
      const result = await paymentService.handleFlutterwaveWebhook(req.body, signature);

      paymentLogger.info('Flutterwave webhook processed', {
        eventType: req.body?.event,
        received: result.received,
      });

      return res.status(200).json({
        success: true,
        message: 'Flutterwave webhook processed successfully',
      });
    } catch (error) {
      paymentLogger.error('Flutterwave webhook processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return next(new AppError('Flutterwave webhook processing failed', 400));
    }
  }
);

// =============================================
// GET PAYMENT BY ID
// =============================================
export const getPaymentById = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const { paymentId } = req.params;

    if (!userId) {
      return next(new AppError('Authentication required', 401));
    }

    if (!paymentId) {
      return next(new AppError('Payment ID is required', 400));
    }

    try {
      const payment = await paymentService.getPaymentById(paymentId);

      if (!payment) {
        return next(new AppError('Payment not found', 404));
      }

      // Check if user owns this payment (through booking)
      const booking = await bookingService.getBookingById(payment.booking_id);
      
      if (!booking || booking.user_id !== userId) {
        return next(new AppError('You can only view your own payments', 403));
      }

      return res.status(200).json({
        success: true,
        data: payment,
      });
    } catch (error) {
      return next(new AppError('Failed to retrieve payment', 500));
    }
  }
);

// =============================================
// GET USER PAYMENTS
// =============================================
export const getUserPayments = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;

    if (!userId) {
      return next(new AppError('Authentication required', 401));
    }

    try {
      const payments = await paymentService.getUserPayments(userId);

      return res.status(200).json({
        success: true,
        count: payments.length,
        data: payments,
      });
    } catch (error) {
      return next(new AppError('Failed to retrieve payments', 500));
    }
  }
);

// =============================================
// REFUND PAYMENT (ADMIN ONLY)
// =============================================
export const refundPayment = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { paymentId } = req.params;
    const { amount, reason } = req.body;

    if (!paymentId) {
      return next(new AppError('Payment ID is required', 400));
    }

    try {
      const refundResult = await paymentService.refundPayment(paymentId, amount, reason);

      paymentLogger.info('Payment refund initiated', {
        paymentId,
        amount,
        reason,
        adminUserId: req.user?.id,
      });

      return res.status(200).json({
        success: true,
        message: 'Refund initiated successfully',
        data: refundResult,
      });
    } catch (error) {
      paymentLogger.error('Payment refund failed', {
        paymentId,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return next(new AppError('Refund processing failed', 500));
    }
  }
);

// =============================================
// GET PAYMENT ANALYTICS (ADMIN ONLY)
// =============================================
export const getPaymentAnalytics = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { startDate, endDate } = req.query;

    // Default to last 30 days if no dates provided
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    try {
      const analytics = await paymentService.getPaymentAnalytics(start, end);

      return res.status(200).json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      return next(new AppError('Failed to retrieve payment analytics', 500));
    }
  }
);