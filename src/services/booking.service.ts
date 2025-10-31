import { transaction, query } from '../config/database.js';
import { CreateBookingDTO } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import * as cache from './cache.service.js';
import { logAudit } from '../utils/logger.js';

// =============================================
// CREATE BOOKING (OPTIMIZED WITH LOCKING)
// =============================================
export const createBooking = async (userId: string, bookingData: CreateBookingDTO) => {
  const { accommodation_id, checkin_date, checkout_date, guest_count, total_amount, notes } = bookingData;
  
  // Use distributed lock to prevent race conditions
  return cache.withLock(
    `booking:create:${accommodation_id}:${checkin_date}`,
    async () => {
      return transaction(async (client) => {
        // Calculate number of nights
        const checkin = new Date(checkin_date);
        const checkout = new Date(checkout_date);
        const nights = Math.ceil((checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24));

        if (nights < 1) {
          throw new AppError('Invalid date range', 400);
        }

        // For accommodation-level bookings, we don't need room-specific logic
        // The total_amount is provided directly in the request

        // Create booking
        const bookingResult = await client.query(
          `INSERT INTO bookings (
            user_id, accommodation_id, status, total_amount, currency,
            checkin_date, checkout_date, guest_count, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *`,
          [
            userId,
            accommodation_id,
            'pending',
            total_amount,
            'ZAR',
            checkin_date,
            checkout_date,
            guest_count,
            notes || null,
          ]
        );

        const booking = bookingResult.rows[0];

        // Create notification
        await client.query(
          `INSERT INTO notifications (user_id, type, message)
           VALUES ($1, $2, $3)`,
          [
            userId,
            'booking_confirmation',
            `Your booking has been created successfully.`,
          ]
        );

        // Log audit trail
        logAudit(userId, 'CREATE_BOOKING', {
          booking_id: booking.id,
          accommodation_id,
          total_amount,
        });

        // Invalidate caches
        await cache.delPattern(`${cache.CachePrefix.AVAILABILITY}*`);

        // Get complete booking details
        return await getBookingById(booking.id, client);
      });
    },
    15000 // 15 second lock timeout
  );
};

// =============================================
// GET BOOKING BY ID (WITH CACHING)
// =============================================
export const getBookingById = async (bookingId: string, client?: any) => {
  const cacheKey = `${cache.CachePrefix.BOOKING}${bookingId}`;
  const cached = await cache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const result = client ? await client.query(
    `SELECT
      b.*,
      a.name as accommodation_name,
      a.address,
      a.city,
      a.country,
      u.name as user_name,
      u.email as user_email,
      u.phone as user_phone,
      (
        SELECT json_agg(json_build_object(
          'id', bi.id,
          'room_id', bi.room_id,
          'room_name', r.name,
          'price_per_night', bi.price_per_night,
          'nights', bi.nights,
          'quantity', bi.quantity,
          'subtotal', bi.price_per_night * bi.nights * bi.quantity
        ))
        FROM booking_items bi
        INNER JOIN rooms r ON bi.room_id = r.id
        WHERE bi.booking_id = b.id
      ) as items,
      (
        SELECT json_agg(
          json_build_object(
            'id', p.id,
            'provider', p.payment_provider,
            'status', p.status,
            'amount', p.amount,
            'currency', p.currency,
            'transaction_id', p.provider_reference,
            'created_at', p.created_at
          ) ORDER BY p.created_at DESC
        )
        FROM payments p
        WHERE p.booking_id = b.id
      ) as payments
    FROM bookings b
    INNER JOIN accommodations a ON b.accommodation_id = a.id
    INNER JOIN users u ON b.user_id = u.id
    WHERE b.id = $1 AND a.is_active = true`,
    [bookingId]
  ) : await query(
    `SELECT
      b.*,
      a.name as accommodation_name,
      a.address,
      a.city,
      a.country,
      u.name as user_name,
      u.email as user_email,
      u.phone as user_phone,
      (
        SELECT json_agg(json_build_object(
          'id', bi.id,
          'room_id', bi.room_id,
          'room_name', r.name,
          'price_per_night', bi.price_per_night,
          'nights', bi.nights,
          'quantity', bi.quantity,
          'subtotal', bi.price_per_night * bi.nights * bi.quantity
        ))
        FROM booking_items bi
        INNER JOIN rooms r ON bi.room_id = r.id
        WHERE bi.booking_id = b.id
      ) as items,
      (
        SELECT json_agg(
          json_build_object(
            'id', p.id,
            'provider', p.payment_provider,
            'status', p.status,
            'amount', p.amount,
            'currency', p.currency,
            'transaction_id', p.provider_reference,
            'created_at', p.created_at
          ) ORDER BY p.created_at DESC
        )
        FROM payments p
        WHERE p.booking_id = b.id
      ) as payments
    FROM bookings b
    INNER JOIN accommodations a ON b.accommodation_id = a.id
    INNER JOIN users u ON b.user_id = u.id
    WHERE b.id = $1 AND a.is_active = true`,
    [bookingId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Booking not found', 404);
  }

  const booking = result.rows[0];

  // Cache for 5 minutes
  await cache.set(cacheKey, booking, 300);

  return booking;
};

// =============================================
// GET USER BOOKINGS (WITH PAGINATION)
// =============================================
export const getUserBookings = async (userId: string, filters: any = {}) => {
  const {
    page = 1,
    limit = 10,
    status,
    sort_by = 'created_at',
    sort_order = 'DESC'
  } = filters;

  const offset = (page - 1) * limit;
  const conditions = ['b.user_id = $1'];
  const params = [userId];

  if (status) {
    params.push(status);
    conditions.push(`b.status = $${params.length}`);
  }

  const whereClause = conditions.join(' AND ');
  const orderClause = `ORDER BY b.${sort_by} ${sort_order}`;

  const [bookingsResult, countResult] = await Promise.all([
    query(
      `SELECT
        b.*,
        a.name as accommodation_name,
        a.address,
        a.city,
        a.country,
        (
          SELECT p.url
          FROM photos p
          WHERE p.accommodation_id = a.id
          ORDER BY p.created_at ASC
          LIMIT 1
        ) as featured_image,
        (
          SELECT COUNT(*)
          FROM booking_items bi
          WHERE bi.booking_id = b.id
        ) as room_count,
        COALESCE((
          SELECT status
          FROM payments p
          WHERE p.booking_id = b.id
          ORDER BY p.created_at DESC
          LIMIT 1
        ), 'unpaid') as payment_status
      FROM bookings b
      INNER JOIN accommodations a ON b.accommodation_id = a.id
      WHERE ${whereClause} AND a.is_active = true
      ${orderClause}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    query(
      `SELECT COUNT(*) as total
       FROM bookings b
       INNER JOIN accommodations a ON b.accommodation_id = a.id
       WHERE ${whereClause} AND a.is_active = true`,
      params
    )
  ]);

  const total = parseInt(countResult.rows[0].total);
  const totalPages = Math.ceil(total / limit);

  return {
    bookings: bookingsResult.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    }
  };
};

// =============================================
// UPDATE BOOKING STATUS
// =============================================
export const updateBookingStatus = async (bookingId: string, status: string, userId?: string) => {
  return transaction(async (client) => {
    // Validate status
    const validStatuses = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      throw new AppError('Invalid booking status', 400);
    }

    // Update booking
    const result = await client.query(
      `UPDATE bookings 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, bookingId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Booking not found', 404);
    }

    const booking = result.rows[0];

    // Handle inventory restoration for cancellations
    if (status === 'cancelled') {
      // Restore room inventory
      await client.query(
        `UPDATE room_inventory
         SET available_units = available_units + bi.quantity
         FROM booking_items bi
         WHERE room_inventory.room_id = bi.room_id
         AND room_inventory.date >= $1
         AND room_inventory.date < $2
         AND bi.booking_id = $3`,
        [booking.checkin_date, booking.checkout_date, bookingId]
      );
    }

    // Create status change notification
    await client.query(
      `INSERT INTO notifications (user_id, type, message)
       VALUES ($1, $2, $3)`,
      [
        booking.user_id,
        'booking_status_change',
        `Your booking status has been updated to: ${status}`,
      ]
    );

    // Log audit trail
    if (userId) {
      logAudit(userId, 'UPDATE_BOOKING_STATUS', {
        booking_id: bookingId,
        old_status: booking.status,
        new_status: status,
      });
    }

    // Invalidate caches
    await cache.del(`${cache.CachePrefix.BOOKING}${bookingId}`);
    await cache.delPattern(`${cache.CachePrefix.USER_BOOKINGS}${booking.user_id}*`);

    return await getBookingById(bookingId);
  });
};

// =============================================
// CANCEL BOOKING
// =============================================
export const cancelBooking = async (bookingId: string, userId: string, reason?: string) => {
  return transaction(async (client) => {
    const bookingResult = await client.query(
      'SELECT * FROM bookings WHERE id = $1 AND user_id = $2',
      [bookingId, userId]
    );

    if (bookingResult.rows.length === 0) {
      throw new AppError('Booking not found or access denied', 404);
    }

    const booking = bookingResult.rows[0];

    // Check if booking can be cancelled
    if (!['pending', 'confirmed'].includes(booking.status)) {
      throw new AppError('Booking cannot be cancelled', 400);
    }

    // Check cancellation policy (24 hours before check-in)
    const checkinDate = new Date(booking.checkin_date);
    const now = new Date();
    const hoursUntilCheckin = (checkinDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilCheckin < 24) {
      throw new AppError('Cancellation not allowed within 24 hours of check-in', 400);
    }

    // Update booking status
    await client.query(
      `UPDATE bookings 
       SET status = 'cancelled', notes = COALESCE(notes || ' | ', '') || $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [reason || 'Cancelled by user', bookingId]
    );

    // Restore room inventory
    await client.query(
      `UPDATE room_inventory
       SET available_units = available_units + bi.quantity
       FROM booking_items bi
       WHERE room_inventory.room_id = bi.room_id
       AND room_inventory.date >= $1
       AND room_inventory.date < $2
       AND bi.booking_id = $3`,
      [booking.checkin_date, booking.checkout_date, bookingId]
    );

    // Process refund if payment was made
    const paymentResult = await client.query(
      `SELECT * FROM payments 
       WHERE booking_id = $1 AND status = 'completed'
       ORDER BY created_at DESC
       LIMIT 1`,
      [bookingId]
    );

    if (paymentResult.rows.length > 0) {
      const payment = paymentResult.rows[0];
      
      // Create refund record
      await client.query(
        `INSERT INTO payments (
          booking_id, payment_provider, status, amount, currency,
          provider_reference
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          bookingId,
          payment.payment_provider,
          'pending',
          payment.amount,
          payment.currency,
          `refund_${payment.provider_reference}`,
        ]
      );
    }

    // Create cancellation notification
    await client.query(
      `INSERT INTO notifications (user_id, type, message)
       VALUES ($1, $2, $3)`,
      [
        userId,
        'booking_cancelled',
        `Your booking has been cancelled successfully.`,
      ]
    );

    // Log audit trail
    logAudit(userId, 'CANCEL_BOOKING', {
      booking_id: bookingId,
      reason,
    });

    // Invalidate caches
    await cache.del(`${cache.CachePrefix.BOOKING}${bookingId}`);
    await cache.delPattern(`${cache.CachePrefix.USER_BOOKINGS}${userId}*`);
    await cache.delPattern(`${cache.CachePrefix.AVAILABILITY}*`);

    return { success: true, message: 'Booking cancelled successfully' };
  });
};

// =============================================
// GET BOOKING STATISTICS
// =============================================
export const getBookingStatistics = async (filters: any = {}) => {
  const { start_date, end_date, accommodation_id } = filters;
  
  const cacheKey = `${cache.CachePrefix.BOOKING_STATS}${JSON.stringify(filters)}`;
  const cached = await cache.get(cacheKey);
  
  if (cached) {
    return cached;
  }

  const conditions = [];
  const params: any[] = [];

  if (start_date) {
    params.push(start_date);
    conditions.push(`b.created_at >= $${params.length}`);
  }

  if (end_date) {
    params.push(end_date);
    conditions.push(`b.created_at <= $${params.length}`);
  }

  if (accommodation_id) {
    params.push(accommodation_id);
    conditions.push(`b.accommodation_id = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [
    totalBookings,
    statusBreakdown,
    revenueStats,
    monthlyTrends
  ] = await Promise.all([
    // Total bookings
    query(
      `SELECT 
        COUNT(*) as total_bookings,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_bookings,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_bookings,
        AVG(total_amount) as average_booking_value
       FROM bookings b ${whereClause}`,
      params
    ),

    // Status breakdown
    query(
      `SELECT 
        status,
        COUNT(*) as count,
        SUM(total_amount) as total_revenue
       FROM bookings b ${whereClause}
       GROUP BY status
       ORDER BY count DESC`,
      params
    ),

    // Revenue statistics
    query(
      `SELECT 
        SUM(total_amount) as total_revenue,
        SUM(total_amount) FILTER (WHERE status != 'cancelled') as confirmed_revenue,
        COUNT(DISTINCT user_id) as unique_customers
       FROM bookings b ${whereClause}`,
      params
    ),

    // Monthly trends
    query(
      `SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as bookings,
        SUM(total_amount) as revenue
       FROM bookings b ${whereClause}
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY month DESC
       LIMIT 12`,
      params
    )
  ]);

  const stats = {
    overview: totalBookings.rows[0],
    status_breakdown: statusBreakdown.rows,
    revenue: revenueStats.rows[0],
    monthly_trends: monthlyTrends.rows,
  };

  // Cache for 1 hour
  await cache.set(cacheKey, stats, 3600);
  
  return stats;
};

// =============================================
// SEND BOOKING REMINDERS
// =============================================
export const sendBookingReminders = async () => {
  // Send reminders for bookings with check-in tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const result = await query(
    `INSERT INTO notifications (user_id, type, message, metadata)
     SELECT 
       b.user_id,
       'checkin_reminder',
       $2,
       json_build_object('booking_id', b.id)
     FROM bookings b
     INNER JOIN accommodations a ON b.accommodation_id = a.id
     WHERE b.checkin_date = $1
     AND b.status = 'confirmed'
     AND NOT EXISTS (
       SELECT 1 FROM notifications n
       WHERE n.user_id = b.user_id
       AND n.type = 'checkin_reminder'
       AND n.metadata->>'booking_id' = b.id::text
       AND n.created_at >= CURRENT_DATE
     )
     RETURNING user_id`,
    [
      tomorrowStr,
      `Reminder: Your check-in is tomorrow!`,
    ]
  );

  return { reminders_sent: result.rows.length };
};

// =============================================
// HELPER FUNCTIONS
// =============================================

// Generate unique confirmation code
function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// =============================================
// UPDATE USER BOOKING
// =============================================
export const updateUserBooking = async (bookingId: string, userId: string, updateData: any) => {
  return transaction(async (client) => {
    // First, check if booking exists and belongs to user
    const bookingResult = await client.query(
      'SELECT * FROM bookings WHERE id = $1 AND user_id = $2',
      [bookingId, userId]
    );

    if (bookingResult.rows.length === 0) {
      throw new AppError('Booking not found or access denied', 404);
    }

    const booking = bookingResult.rows[0];

    // Check if booking can be updated (only pending bookings)
    if (booking.status !== 'pending') {
      throw new AppError('Only pending bookings can be updated', 400);
    }

    // Check if check-in date is in the future (at least 24 hours from now)
    const checkinDate = new Date(booking.checkin_date);
    const now = new Date();
    const hoursUntilCheckin = (checkinDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilCheckin < 24) {
      throw new AppError('Bookings cannot be updated within 24 hours of check-in', 400);
    }

    // Build update query dynamically
    const updateFields = [];
    const params = [];
    let paramIndex = 1;

    if (updateData.checkin_date !== undefined) {
      updateFields.push(`checkin_date = $${paramIndex}`);
      params.push(updateData.checkin_date);
      paramIndex++;
    }

    if (updateData.checkout_date !== undefined) {
      updateFields.push(`checkout_date = $${paramIndex}`);
      params.push(updateData.checkout_date);
      paramIndex++;
    }

    if (updateData.guest_count !== undefined) {
      updateFields.push(`guest_count = $${paramIndex}`);
      params.push(updateData.guest_count);
      paramIndex++;
    }

    if (updateData.notes !== undefined) {
      updateFields.push(`notes = $${paramIndex}`);
      params.push(updateData.notes);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      throw new AppError('No valid fields to update', 400);
    }

    // Add updated_at timestamp
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    // Execute update
    params.push(bookingId);
    const updateQuery = `
      UPDATE bookings
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await client.query(updateQuery, params);

    // Create update notification
    await client.query(
      `INSERT INTO notifications (user_id, type, message)
       VALUES ($1, $2, $3)`,
      [
        userId,
        'booking_updated',
        `Your booking has been updated successfully.`,
      ]
    );

    // Log audit trail
    logAudit(userId, 'UPDATE_USER_BOOKING', {
      booking_id: bookingId,
      updated_fields: Object.keys(updateData),
    });

    // Invalidate caches
    await cache.del(`${cache.CachePrefix.BOOKING}${bookingId}`);
    await cache.delPattern(`${cache.CachePrefix.USER_BOOKINGS}${userId}*`);

    return await getBookingById(bookingId);
  });
};

// =============================================
// EXPORT BOOKING DATA (FOR ADMIN)
// =============================================
export const exportBookingData = async (filters: any) => {
  const conditions = [];
  const params: any[] = [];

  if (filters?.start_date) {
    params.push(filters.start_date);
    conditions.push(`b.created_at >= $${params.length}`);
  }

  if (filters?.end_date) {
    params.push(filters.end_date);
    conditions.push(`b.created_at <= $${params.length}`);
  }

  if (filters?.status) {
    params.push(filters.status);
    conditions.push(`b.status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT
      b.id,
      b.confirmation_code,
      b.status,
      b.total_amount,
      b.currency,
      b.checkin_date,
      b.checkout_date,
      b.guest_count,
      b.created_at,
      u.name as customer_name,
      u.email as customer_email,
      u.phone as customer_phone,
      a.name as accommodation_name,
      a.city,
      a.country,
      (
        SELECT string_agg(r.name || ' (x' || bi.quantity || ')', ', ')
        FROM booking_items bi
        INNER JOIN rooms r ON bi.room_id = r.id
        WHERE bi.booking_id = b.id
      ) as rooms,
      COALESCE(p.status, 'unpaid') as payment_status
    FROM bookings b
    INNER JOIN users u ON b.user_id = u.id
    INNER JOIN accommodations a ON b.accommodation_id = a.id
    LEFT JOIN LATERAL (
      SELECT status FROM payments
      WHERE booking_id = b.id
      ORDER BY created_at DESC
      LIMIT 1
    ) p ON true
    ${whereClause}
    ORDER BY b.created_at DESC`,
    params
  );

  return result.rows;
};
