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
