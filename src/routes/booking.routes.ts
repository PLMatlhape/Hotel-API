import { Router } from 'express';
import * as bookingController from '../controllers/booking.controller.js';
import { protect } from '../middleware/auth.js';
import { createBookingValidator, updateBookingStatusValidator, updateUserBookingValidator } from '../utils/validators.js';
import { validate } from '../middleware/validation.js';

const router = Router();

// =============================================
// PROTECTED ROUTES
// =============================================

// @route   GET /api/bookings
// @desc    Get user's bookings
// @access  Private
router.get('/', protect, bookingController.getUserBookings);

// @route   GET /api/bookings/stats
// @desc    Get booking statistics
// @access  Private (Admin)
router.get('/stats', protect, bookingController.getBookingStats);

// @route   GET /api/bookings/:id
// @desc    Get booking by ID
// @access  Private
router.get('/:id', protect, bookingController.getBookingById);

// @route   POST /api/bookings
// @desc    Create new booking
// @access  Private
router.post('/', protect, createBookingValidator, validate, bookingController.createBooking);

// @route   PUT /api/bookings/:id/status
// @desc    Update booking status
// @access  Private
router.put('/:id/status', protect, updateBookingStatusValidator, validate, bookingController.updateBookingStatus);

// @route   PUT /api/bookings/:id
// @desc    Update user booking
// @access  Private
router.put('/:id', protect, updateUserBookingValidator, validate, bookingController.updateUserBooking);

// @route   DELETE /api/bookings/:id
// @desc    Cancel booking
// @access  Private
router.delete('/:id', protect, bookingController.cancelBooking);

export default router;
