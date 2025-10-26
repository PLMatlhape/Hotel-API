import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import { query } from '../config/database.js';
import * as authService from '../services/auth.service.js';
import * as bookingService from '../services/booking.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// =============================================
// GET ALL USERS (ADMIN ONLY)
// =============================================
export const getAllUsers = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Get query parameters for pagination and filtering
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Build query conditions
    const conditions: string[] = [];
    const values: any[] = [];

    // Filter by role if provided
    if (req.query.role) {
      conditions.push(`role = $${values.length + 1}`);
      values.push(req.query.role);
    }

    // Filter by active status if provided
    if (req.query.is_active !== undefined) {
      conditions.push(`is_active = $${values.length + 1}`);
      values.push(req.query.is_active === 'true');
    }

    // Build WHERE clause
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
    const countResult = await query(countQuery, values);
    const totalUsers = parseInt(countResult.rows[0].total);

    // Get users with pagination
    const usersQuery = `
      SELECT id, email, name, phone, role, created_at, updated_at, is_active
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;

    values.push(limit, offset);
    const usersResult = await query(usersQuery, values);

    const totalPages = Math.ceil(totalUsers / limit);

    return res.status(200).json({
      success: true,
      data: {
        users: usersResult.rows,
        pagination: {
          currentPage: page,
          totalPages,
          totalUsers,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  }
);

// =============================================
// GET USER BY ID (ADMIN ONLY)
// =============================================
export const getUserById = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
    }

    const user = await authService.getUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  }
);

// =============================================
// UPDATE USER STATUS (ADMIN ONLY)
// =============================================
export const updateUserStatus = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { is_active } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'is_active must be a boolean value',
      });
    }

    // Check if user exists
    const existingUser = await authService.getUserById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Update user status
    const updateQuery = `
      UPDATE users
      SET is_active = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, email, name, phone, role, created_at, updated_at, is_active
    `;

    const result = await query(updateQuery, [is_active, id]);

    return res.status(200).json({
      success: true,
      data: result.rows[0],
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully`,
    });
  }
);

// =============================================
// UPDATE USER (ADMIN ONLY)
// =============================================
export const updateUser = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { name, email, phone } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
    }

    // Check if user exists
    const existingUser = await authService.getUserById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Update user
    const updatedUser = await authService.updateUserByAdmin(id, { name, email, phone });

    return res.status(200).json({
      success: true,
      data: updatedUser,
      message: 'User updated successfully',
    });
  }
);

// =============================================
// GET ALL BOOKINGS (ADMIN ONLY)
// =============================================
export const getAllBookings = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Get query parameters for pagination and filtering
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Build query conditions
    const conditions: string[] = [];
    const values: any[] = [];

    // Filter by status if provided
    if (req.query.status) {
      conditions.push(`b.status = $${values.length + 1}`);
      values.push(req.query.status);
    }

    // Filter by accommodation_id if provided
    if (req.query.accommodation_id) {
      conditions.push(`b.accommodation_id = $${values.length + 1}`);
      values.push(req.query.accommodation_id);
    }

    // Filter by user_id if provided
    if (req.query.user_id) {
      conditions.push(`b.user_id = $${values.length + 1}`);
      values.push(req.query.user_id);
    }

    // Filter by date range if provided
    if (req.query.start_date) {
      conditions.push(`b.checkin_date >= $${values.length + 1}`);
      values.push(req.query.start_date);
    }

    if (req.query.end_date) {
      conditions.push(`b.checkout_date <= $${values.length + 1}`);
      values.push(req.query.end_date);
    }

    // Build WHERE clause
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as total FROM bookings b ${whereClause}`;
    const countResult = await query(countQuery, values);
    const totalBookings = parseInt(countResult.rows[0].total);

    // Get bookings with pagination
    const bookingsQuery = `
      SELECT
        b.id,
        b.status,
        b.total_amount,
        b.currency,
        b.checkin_date,
        b.checkout_date,
        b.guest_count,
        b.created_at,
        b.updated_at,
        a.name as accommodation_name,
        a.city,
        a.country,
        u.name as customer_name,
        u.email as customer_email,
        u.phone as customer_phone,
        1 as room_count,
        COALESCE((
          SELECT status
          FROM payments p
          WHERE p.booking_id = b.id
          ORDER BY p.created_at DESC
          LIMIT 1
        ), 'unpaid') as payment_status
      FROM bookings b
      INNER JOIN accommodations a ON b.accommodation_id = a.id
      INNER JOIN users u ON b.user_id = u.id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;

    values.push(limit, offset);
    const bookingsResult = await query(bookingsQuery, values);

    const totalPages = Math.ceil(totalBookings / limit);

    return res.status(200).json({
      success: true,
      data: {
        bookings: bookingsResult.rows,
        pagination: {
          currentPage: page,
          totalPages,
          totalBookings,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  }
);

// =============================================
// DELETE USER (ADMIN ONLY)
// =============================================
export const deleteUser = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
    }

    // Check if user exists
    const existingUser = await authService.getUserById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Delete user
    const deleteQuery = `
      DELETE FROM users
      WHERE id = $1
      RETURNING id, email, name, phone, role, created_at, updated_at, is_active
    `;

    const result = await query(deleteQuery, [id]);

    return res.status(200).json({
      success: true,
      data: result.rows[0],
      message: 'User deleted successfully',
    });
  }
);
