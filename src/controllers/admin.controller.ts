import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import { query } from '../config/database.js';
import * as authService from '../services/auth.service.js';
import * as bookingService from '../services/booking.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createObjectCsvWriter } from 'csv-writer';

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
// GET SYSTEM ANALYTICS (ADMIN ONLY)
// =============================================
export const getSystemAnalytics = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Get total users count
    const totalUsersQuery = 'SELECT COUNT(*) as total FROM users';
    const totalUsersResult = await query(totalUsersQuery);
    const totalUsers = parseInt(totalUsersResult.rows[0].total);

    // Get active users count
    const activeUsersQuery = 'SELECT COUNT(*) as total FROM users WHERE is_active = true';
    const activeUsersResult = await query(activeUsersQuery);
    const activeUsers = parseInt(activeUsersResult.rows[0].total);

    // Get total accommodations count
    const totalAccommodationsQuery = 'SELECT COUNT(*) as total FROM accommodations';
    const totalAccommodationsResult = await query(totalAccommodationsQuery);
    const totalAccommodations = parseInt(totalAccommodationsResult.rows[0].total);

    // Get total bookings count
    const totalBookingsQuery = 'SELECT COUNT(*) as total FROM bookings';
    const totalBookingsResult = await query(totalBookingsQuery);
    const totalBookings = parseInt(totalBookingsResult.rows[0].total);

    // Get bookings by status
    const bookingsByStatusQuery = `
      SELECT status, COUNT(*) as count
      FROM bookings
      GROUP BY status
    `;
    const bookingsByStatusResult = await query(bookingsByStatusQuery);
    const bookingsByStatus = bookingsByStatusResult.rows.reduce((acc: any, row: any) => {
      acc[row.status] = parseInt(row.count);
      return acc;
    }, {});

    // Get total revenue
    const totalRevenueQuery = `
      SELECT COALESCE(SUM(total_amount), 0) as total
      FROM bookings
      WHERE status = 'completed'
    `;
    const totalRevenueResult = await query(totalRevenueQuery);
    const totalRevenue = parseFloat(totalRevenueResult.rows[0].total);

    // Get monthly revenue for the last 12 months
    const monthlyRevenueQuery = `
      SELECT
        DATE_TRUNC('month', created_at) as month,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM bookings
      WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
    `;
    const monthlyRevenueResult = await query(monthlyRevenueQuery);
    const monthlyRevenue = monthlyRevenueResult.rows.map((row: any) => ({
      month: row.month,
      revenue: parseFloat(row.revenue),
    }));

    // Get recent bookings (last 30 days)
    const recentBookingsQuery = `
      SELECT COUNT(*) as total
      FROM bookings
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `;
    const recentBookingsResult = await query(recentBookingsQuery);
    const recentBookings = parseInt(recentBookingsResult.rows[0].total);

    // Get top accommodations by bookings
    const topAccommodationsQuery = `
      SELECT
        a.name,
        a.city,
        COUNT(b.id) as booking_count
      FROM accommodations a
      LEFT JOIN bookings b ON a.id = b.accommodation_id
      GROUP BY a.id, a.name, a.city
      ORDER BY booking_count DESC
      LIMIT 5
    `;
    const topAccommodationsResult = await query(topAccommodationsQuery);
    const topAccommodations = topAccommodationsResult.rows.map((row: any) => ({
      name: row.name,
      city: row.city,
      booking_count: parseInt(row.booking_count),
    }));

    // Get payment statistics
    const paymentStatsQuery = `
      SELECT
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as total_pending,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_payments,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments
      FROM payments
    `;
    const paymentStatsResult = await query(paymentStatsQuery);
    const paymentStats = paymentStatsResult.rows[0];

    const analytics = {
      overview: {
        totalUsers,
        activeUsers,
        totalAccommodations,
        totalBookings,
        totalRevenue,
        recentBookings,
      },
      bookings: {
        byStatus: bookingsByStatus,
        monthlyRevenue,
        topAccommodations,
      },
      payments: {
        totalPaid: parseFloat(paymentStats.total_paid),
        totalPending: parseFloat(paymentStats.total_pending),
        completedPayments: parseInt(paymentStats.completed_payments),
        pendingPayments: parseInt(paymentStats.pending_payments),
      },
    };

    return res.status(200).json({
      success: true,
      data: analytics,
      message: 'System analytics retrieved successfully',
    });
  }
);

// =============================================
// EXPORT BOOKINGS DATA (ADMIN ONLY)
// =============================================
export const exportBookings = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Get filters from query params (GET) or body (POST)
    const filters = req.method === 'GET' ? req.query : req.body;
    const { status, start_date, end_date, accommodation_id, user_id } = filters;

    // Build query conditions
    const conditions: string[] = [];
    const values: any[] = [];

    // Filter by status if provided
    if (status) {
      conditions.push(`b.status = $${values.length + 1}`);
      values.push(status);
    }

    // Filter by accommodation_id if provided
    if (accommodation_id) {
      conditions.push(`b.accommodation_id = $${values.length + 1}`);
      values.push(accommodation_id);
    }

    // Filter by user_id if provided
    if (user_id) {
      conditions.push(`b.user_id = $${values.length + 1}`);
      values.push(user_id);
    }

    // Filter by date range if provided
    if (start_date) {
      conditions.push(`b.checkin_date >= $${values.length + 1}`);
      values.push(start_date);
    }

    if (end_date) {
      conditions.push(`b.checkout_date <= $${values.length + 1}`);
      values.push(end_date);
    }

    // Build WHERE clause
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get all bookings data for export
    const exportQuery = `
      SELECT
        b.id as booking_id,
        b.status as booking_status,
        b.total_amount,
        b.currency,
        b.checkin_date,
        b.checkout_date,
        b.guest_count,
        b.created_at as booking_created_at,
        b.updated_at as booking_updated_at,
        a.name as accommodation_name,
        a.city as accommodation_city,
        a.country as accommodation_country,
        u.name as customer_name,
        u.email as customer_email,
        u.phone as customer_phone,
        COALESCE((
          SELECT status
          FROM payments p
          WHERE p.booking_id = b.id
          ORDER BY p.created_at DESC
          LIMIT 1
        ), 'unpaid') as payment_status,
        COALESCE((
          SELECT amount
          FROM payments p
          WHERE p.booking_id = b.id
          ORDER BY p.created_at DESC
          LIMIT 1
        ), 0) as payment_amount
      FROM bookings b
      INNER JOIN accommodations a ON b.accommodation_id = a.id
      INNER JOIN users u ON b.user_id = u.id
      ${whereClause}
      ORDER BY b.created_at DESC
    `;

    const result = await query(exportQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No bookings found matching the criteria',
      });
    }

    // Define CSV headers
    const csvWriter = createObjectCsvWriter({
      path: 'temp_bookings_export.csv',
      header: [
        { id: 'booking_id', title: 'Booking ID' },
        { id: 'booking_status', title: 'Status' },
        { id: 'total_amount', title: 'Total Amount' },
        { id: 'currency', title: 'Currency' },
        { id: 'checkin_date', title: 'Check-in Date' },
        { id: 'checkout_date', title: 'Check-out Date' },
        { id: 'guest_count', title: 'Guest Count' },
        { id: 'booking_created_at', title: 'Booking Created' },
        { id: 'booking_updated_at', title: 'Booking Updated' },
        { id: 'accommodation_name', title: 'Accommodation' },
        { id: 'accommodation_city', title: 'City' },
        { id: 'accommodation_country', title: 'Country' },
        { id: 'customer_name', title: 'Customer Name' },
        { id: 'customer_email', title: 'Customer Email' },
        { id: 'customer_phone', title: 'Customer Phone' },
        { id: 'payment_status', title: 'Payment Status' },
        { id: 'payment_amount', title: 'Payment Amount' },
      ],
    });

    // Write data to CSV
    await csvWriter.writeRecords(result.rows);

    // Set response headers for file download
    const fileName = `bookings_export_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Stream the file
    const fs = await import('fs');
    const fileStream = fs.createReadStream('temp_bookings_export.csv');
    fileStream.pipe(res);

    // Clean up temp file after streaming
    fileStream.on('end', () => {
      fs.unlink('temp_bookings_export.csv', (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    });

    // Return a promise that resolves when streaming is complete
    return new Promise<void>((resolve, reject) => {
      fileStream.on('end', resolve);
      fileStream.on('error', reject);
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
