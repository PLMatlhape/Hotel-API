import { Router } from 'express';
import * as bookingController from '../controllers/booking.controller.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// =============================================
// PROTECTED ROUTES
// =============================================

// @route   GET /api/bookings
// @desc    Get user's bookings
// @access  Private
router.get('/', protect, bookingController.getUserBookings);

// @route   GET /api/bookings/:id
// @desc    Get booking by ID
// @access  Private
router.get('/:id', protect, bookingController.getBookingById);

// @route   POST /api/bookings
// @desc    Create new booking
// @access  Private
router.post('/', protect, bookingController.createBooking);

export default router;
