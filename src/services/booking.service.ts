import { transaction, query } from '../config/database.js';
import { CreateBookingDTO } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import * as cache from './cache.service.js';
import { logAudit } from '../utils/logger.js';

// =============================================
// CREATE BOOKING (OPTIMIZED WITH LOCKING)
// =============================================
export const createBooking = async (userId: string, bookingData: CreateBookingDTO) => {
  const { accommodation_id, checkin_date, checkout_date, guest_count, rooms, notes } = bookingData;
  
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

        // Batch fetch all room details
        const roomIds = rooms.map(r => r.room_id);
        const roomsResult = await client.query(
          `SELECT r.*, 
            (SELECT COUNT(*) FROM room_inventory WHERE room_id = r.id) as has_inventory
           FROM rooms r 
           WHERE r.id = ANY($1) AND r.accommodation_id = $2`,
          [roomIds, accommodation_id]
        );

        if (roomsResult.rows.length !== roomIds.length) {
          throw new AppError('One or more rooms not found', 404);
        }

        const roomMap = new Map(roomsResult.rows.map(r => [r.id, r]));

        // Check availability for all rooms in a single query
        const availabilityCheck = await client.query(
          `
          WITH RECURSIVE date_series AS (
            SELECT $1::date as check_date
            UNION ALL
            SELECT (check_date + interval '1 day')::date
            FROM date_series
            WHERE check_date < $2::date - interval '1 day'
          ),
          booked_units AS (
            SELECT 
              bi.room_id,
              ds.check_date,
              COALESCE(SUM(bi.quantity), 0) as booked
            FROM date_series ds
            CROSS JOIN unnest($3::uuid[]) as bi(room_id)
            LEFT JOIN bookings b ON 
              b.checkin_date <= ds.check_date AND
              b.checkout_date > ds.check_date AND
              b.status NOT IN ('cancelled')
            LEFT JOIN booking_items bi2 ON b.id = bi2.booking_id AND bi2.room_id = bi.room_id
            GROUP BY bi.room_id, ds.check_date
          ),
          inventory_check AS (
            SELECT 
              bu.room_id,
              bu.check_date,
              COALESCE(ri.available_units, r.default_units, 10) as available,
              bu.booked,
              COALESCE(ri.available_units, r.default_units, 10) - bu.booked as remaining
            FROM booked_units bu
            INNER JOIN rooms r ON bu.room_id = r.id
            LEFT JOIN room_inventory ri ON ri.room_id = bu.room_id AND ri.date = bu.check_date
          )
          SELECT 
            room_id,
            MIN(remaining) as min_available
          FROM inventory_check
          GROUP BY room_id
          `,
          [checkin_date, checkout_date, roomIds]
        );

        // Validate availability
        const availabilityMap = new Map(
          availabilityCheck.rows.map(r => [r.room_id, r.min_available])
        );

        for (const room of rooms) {
          const available = availabilityMap.get(room.room_id) || 0;
          const roomData = roomMap.get(room.room_id);
          
          if (available < room.quantity) {
            throw new AppError(
              `Insufficient availability for ${roomData?.name}. Available: ${available}, Requested: ${room.quantity}`,
              400
            );
          }
        }

        // Calculate total amount
        let totalAmount = 0;
        const bookingItems = [];

        for (const room of rooms) {
          const roomData = roomMap.get(room.room_id);
          const itemCost = roomData.price_per_night * nights * room.quantity;
          totalAmount += itemCost;

          bookingItems.push({
            room_id: room.room_id,
            price_per_night: roomData.price_per_night,
            nights,
            quantity: room.quantity,
          });
        }

        // Create booking
        const bookingResult = await client.query(
          `INSERT INTO bookings (
            user_id, accommodation_id, status, total_amount, currency,
            checkin_date, checkout_date, guest_count, notes, confirmation_code
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *`,
          [
            userId,
            accommodation_id,
            'pending',
            totalAmount,
            'ZAR',
            checkin_date,
            checkout_date,
            guest_count,
            notes || null,
            generateConfirmationCode(),
          ]
        );

        const booking = bookingResult.rows[0];

        // Batch insert booking items
        const itemValues = bookingItems.map((item, idx) => {
          const offset = idx * 5;
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
        }).join(', ');

        const itemParams = bookingItems.flatMap(item => [
          booking.id,
          item.room_id,
          item.price_per_night,
          item.nights,
          item.quantity,
        ]);

        await client.query(
          `INSERT INTO booking_items (booking_id, room_id, price_per_night, nights, quantity)
           VALUES ${itemValues}`,
          itemParams
        );

        // Batch update inventory
        const inventoryUpdates = [];
        for (const item of bookingItems) {
          let currentDate = new Date(checkin);
          while (currentDate < checkout) {
            const dateStr = currentDate.toISOString().split('T')[0];
            inventoryUpdates.push({
              room_id: item.room_id,
              date: dateStr,
              quantity: item.quantity,
            });
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }

        // Use ON CONFLICT to handle inventory updates efficiently
        for (const update of inventoryUpdates) {
          await client.query(
            `INSERT INTO room_inventory (room_id, date, available_units)
             VALUES ($1, $2, 
               (SELECT COALESCE(
                 (SELECT available_units FROM room_inventory WHERE room_id = $1 AND date = $2),
                 (SELECT default_units FROM rooms WHERE id = $1),
                 10
               ) - $3)
             )
             ON CONFLICT (room_id, date)
             DO UPDATE SET available_units = room_inventory.available_units - $3
             WHERE room_inventory.available_units >= $3`,
            [update.room_id, update.date, update.quantity]
          );
        }

        // Create notification
        await client.query(
          `INSERT INTO notifications (user_id, type, message, metadata)
           VALUES ($1, $2, $3, $4)`,
          [
            userId,
            'booking_confirmation',
            `Your booking (${booking.confirmation_code}) has been created successfully.`,
            JSON.stringify({ booking_id: booking.id }),
          ]
        );

        // Log audit trail
        logAudit(userId, 'CREATE_BOOKING', {
          booking_id: booking.id,
          accommodation_id,
          total_amount: totalAmount,
        });

        // Invalidate caches
        await cache.delPattern(`${cache.CachePrefix.AVAILABILITY}*`);

        // Get complete booking details
        return await getBookingById(booking.id);
      });
    },
    15000 // 15 second lock timeout
  );
};

// =============================================
// GET BOOKING BY ID (WITH CACHING)
// =============================================
export const getBookingById = async (bookingId: string) => {
  const cacheKey = `${cache.CachePrefix.BOOKING}${bookingId}`;
  const cached = await cache.get(cacheKey);
  
  if (cached) {
    return cached;
  }

  const result = await query(
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
        SELECT json_agg(json_build_object(
          'id', p.id,
          'provider', p.provider,
          'status', p.status,
          'amount', p.amount,
          'currency', p.currency,
          'transaction_id', p.transaction_id,
          'created_at', p.created_at
        ))
        FROM payments p
        WHERE p.booking_id = b.id
        ORDER BY p.created_at DESC
      ) as payments
    FROM bookings b
    INNER JOIN accommodations a ON b.accommodation_id = a.id
    INNER JOIN users u ON b.user_id = u.id
    WHERE b.id = $1`,
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
        a.images[1] as featured_image,
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
      WHERE ${whereClause}
      ${orderClause}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    query(
      `SELECT COUNT(*) as total
       FROM bookings b
       WHERE ${whereClause}`,
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
      `INSERT INTO notifications (user_id, type, message, metadata)
       VALUES ($1, $2, $3, $4)`,
      [
        booking.user_id,
        'booking_status_change',
        `Your booking status has been updated to: ${status}`,
        JSON.stringify({ booking_id: bookingId, status }),
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
          booking_id, provider, type, status, amount, currency,
          transaction_id, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          bookingId,
          payment.provider,
          'refund',
          'pending',
          payment.amount,
          payment.currency,
          `refund_${payment.transaction_id}`,
          JSON.stringify({ original_payment_id: payment.id, reason }),
        ]
      );
    }

    // Create cancellation notification
    await client.query(
      `INSERT INTO notifications (user_id, type, message, metadata)
       VALUES ($1, $2, $3, $4)`,
      [
        userId,
        'booking_cancelled',
        `Your booking (${booking.confirmation_code}) has been cancelled successfully.`,
        JSON.stringify({ booking_id: bookingId, reason }),
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