import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import * as bookingService from '../services/booking.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// =============================================
// GET USER BOOKINGS
// =============================================
export const getUserBookings = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Parse query parameters
    const {
      page = '1',
      limit = '10',
      status,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    const filters = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      status: status as string,
      sort_by: sort_by as string,
      sort_order: sort_order as string,
    };

    // Validate pagination parameters
    if (filters.page < 1 || filters.limit < 1 || filters.limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pagination parameters',
      });
    }

    // Get user bookings
    const result = await bookingService.getUserBookings(userId, filters);

    return res.status(200).json({
      success: true,
      data: result,
    });
  }
);

// =============================================
// UPDATE USER BOOKING
// =============================================
export const updateUserBooking = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { checkin_date, checkout_date, guest_count, notes } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Booking ID is required',
      });
    }

    // Update user booking
    const booking = await bookingService.updateUserBooking(id, userId, {
      checkin_date,
      checkout_date,
      guest_count,
      notes,
    });

    return res.status(200).json({
      success: true,
      data: booking,
      message: 'Booking updated successfully',
    });
  }
);

// =============================================
// GET BOOKING BY ID
// =============================================
export const getBookingById = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Booking ID is required',
      });
    }

    // Get booking details
    const booking = await bookingService.getBookingById(id);

    // Check if booking belongs to user (unless admin)
    if (booking.user_id !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    return res.status(200).json({
      success: true,
      data: booking,
    });
  }
);

// =============================================
// CREATE BOOKING
// =============================================
export const createBooking = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const bookingData = req.body;

    // Create booking
    const booking = await bookingService.createBooking(userId, bookingData);

    return res.status(201).json({
      success: true,
      data: booking,
      message: 'Booking created successfully',
    });
  }
);

// =============================================
// UPDATE BOOKING STATUS (ADMIN ONLY)
// =============================================
export const updateBookingStatus = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { id } = req.params;
    const { status } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Only admins can update booking status
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.',
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Booking ID is required',
      });
    }

    // Update booking status
    const booking = await bookingService.updateBookingStatus(id, status, userId);

    return res.status(200).json({
      success: true,
      data: booking,
      message: 'Booking status updated successfully',
    });
  }
);

// =============================================
// CANCEL BOOKING (USER OWNED)
// =============================================
export const cancelBooking = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Booking ID is required',
      });
    }

    // Cancel booking
    const result = await bookingService.cancelBooking(id, userId, reason);

    return res.status(200).json({
      success: true,
      data: result,
      message: 'Booking cancelled successfully',
    });
  }
);

// =============================================
// GET BOOKING STATISTICS (ADMIN ONLY)
// =============================================
export const getBookingStats = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Only admins can access booking statistics
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.',
      });
    }

    // Parse query parameters
    const { start_date, end_date, accommodation_id } = req.query;

    const filters = {
      start_date: start_date as string,
      end_date: end_date as string,
      accommodation_id: accommodation_id as string,
    };

    // Get booking statistics
    const stats = await bookingService.getBookingStatistics(filters);

    return res.status(200).json({
      success: true,
      data: stats,
    });
  }
);
