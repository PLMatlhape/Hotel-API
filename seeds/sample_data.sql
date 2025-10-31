-- Sample Data for mLodge Hotel Booking System
-- Run this after the initial schema migration

-- =============================================
-- SAMPLE USERS
-- =============================================

-- Admin user
INSERT INTO users (id, email, name, phone, password_hash, role, is_active, email_verified) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'admin@mlodgehotel.com', 'Hotel Administrator', '+1234567890', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewaDVr5B4EYs6Nlm', 'admin', true, true),
('550e8400-e29b-41d4-a716-446655440002', 'manager@mlodgehotel.com', 'Hotel Manager', '+1234567891', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewaDVr5B4EYs6Nlm', 'manager', true, true);

-- Sample customers
INSERT INTO users (id, email, name, phone, password_hash, role, is_active, email_verified, preferences) VALUES
('550e8400-e29b-41d4-a716-446655440010', 'john.doe@example.com', 'John Doe', '+1234567892', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewaDVr5B4EYs6Nlm', 'user', true, true, '{"notification_email": true, "newsletter": true}'),
('550e8400-e29b-41d4-a716-446655440011', 'jane.smith@example.com', 'Jane Smith', '+1234567893', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewaDVr5B4EYs6Nlm', 'user', true, true, '{"notification_email": false, "newsletter": true}'),
('550e8400-e29b-41d4-a716-446655440012', 'mike.johnson@example.com', 'Mike Johnson', '+1234567894', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewaDVr5B4EYs6Nlm', 'user', true, false, '{}'),
('550e8400-e29b-41d4-a716-446655440013', 'sarah.wilson@example.com', 'Sarah Wilson', '+1234567895', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewaDVr5B4EYs6Nlm', 'user', true, true, '{"notification_email": true, "newsletter": false}');

-- =============================================
-- SAMPLE ACCOMMODATIONS
-- =============================================

INSERT INTO accommodations (id, name, description, address, location, amenities, policies, contact_info, rating, review_count, is_active, featured, owner_id) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'mLodge Downtown', 'Luxury hotel in the heart of the city with modern amenities and exceptional service.', 
'{"street": "123 Main Street", "city": "Cape Town", "state": "Western Cape", "country": "South Africa", "postal_code": "8001"}',
POINT(-18.4241, 33.9249), -- Cape Town coordinates
'["WiFi", "Parking", "Restaurant", "Bar", "Gym", "Pool", "Spa", "Business Center", "Room Service", "Concierge"]',
'{"check_in": "15:00", "check_out": "11:00", "cancellation": "24 hours", "pets": false, "smoking": false, "age_requirement": 18}',
'{"phone": "+27-21-123-4567", "email": "downtown@mlodgehotel.com", "website": "https://mlodgehotel.com/downtown"}',
4.5, 127, true, true, '550e8400-e29b-41d4-a716-446655440001'),

('660e8400-e29b-41d4-a716-446655440002', 'mLodge Seaside', 'Beachfront resort with stunning ocean views and world-class dining.', 
'{"street": "456 Ocean Drive", "city": "Camps Bay", "state": "Western Cape", "country": "South Africa", "postal_code": "8005"}',
POINT(-18.3771, 33.9553), -- Camps Bay coordinates
'["WiFi", "Beach Access", "Restaurant", "Bar", "Pool", "Spa", "Water Sports", "Balcony", "Room Service", "Valet Parking"]',
'{"check_in": "15:00", "check_out": "11:00", "cancellation": "48 hours", "pets": false, "smoking": false, "age_requirement": 21}',
'{"phone": "+27-21-234-5678", "email": "seaside@mlodgehotel.com", "website": "https://mlodgehotel.com/seaside"}',
4.7, 89, true, true, '550e8400-e29b-41d4-a716-446655440001'),

('660e8400-e29b-41d4-a716-446655440003', 'mLodge Garden', 'Boutique hotel surrounded by beautiful gardens and mountain views.', 
'{"street": "789 Garden Road", "city": "Stellenbosch", "state": "Western Cape", "country": "South Africa", "postal_code": "7600"}',
POINT(-18.8650, 33.9321), -- Stellenbosch coordinates
'["WiFi", "Garden Views", "Restaurant", "Bar", "Pool", "Hiking Trails", "Wine Tasting", "Parking", "Pet Friendly"]',
'{"check_in": "14:00", "check_out": "12:00", "cancellation": "24 hours", "pets": true, "smoking": false, "age_requirement": 18}',
'{"phone": "+27-21-345-6789", "email": "garden@mlodgehotel.com", "website": "https://mlodgehotel.com/garden"}',
4.3, 45, true, false, '550e8400-e29b-41d4-a716-446655440002');

-- =============================================
-- SAMPLE ROOMS
-- =============================================

-- mLodge Downtown Rooms
INSERT INTO rooms (id, accommodation_id, name, type, description, max_occupancy, base_price, currency, size_sqm, floor_number, room_number, amenities) VALUES
('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'Standard City View', 'Standard', 'Comfortable room with city views and modern amenities', 2, 150.00, 'USD', 25, 3, '301', '["WiFi", "TV", "Air Conditioning", "Mini Bar", "Safe", "Coffee Maker"]'),
('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001', 'Deluxe City View', 'Deluxe', 'Spacious room with premium furnishings and city views', 2, 200.00, 'USD', 35, 5, '501', '["WiFi", "TV", "Air Conditioning", "Mini Bar", "Safe", "Coffee Maker", "Bathrobe", "Slippers"]'),
('770e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440001', 'Executive Suite', 'Suite', 'Luxury suite with separate living area and premium amenities', 4, 350.00, 'USD', 60, 10, '1001', '["WiFi", "TV", "Air Conditioning", "Mini Bar", "Safe", "Coffee Maker", "Bathrobe", "Slippers", "Living Area", "Kitchenette"]'),

-- mLodge Seaside Rooms
('770e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440002', 'Ocean View Standard', 'Standard', 'Beautiful room with direct ocean views', 2, 250.00, 'USD', 30, 2, '201', '["WiFi", "TV", "Air Conditioning", "Mini Bar", "Safe", "Coffee Maker", "Ocean View", "Balcony"]'),
('770e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440002', 'Beachfront Suite', 'Suite', 'Premium suite with private balcony and beach access', 4, 500.00, 'USD', 80, 1, '101', '["WiFi", "TV", "Air Conditioning", "Mini Bar", "Safe", "Coffee Maker", "Ocean View", "Private Balcony", "Beach Access", "Jacuzzi"]'),

-- mLodge Garden Rooms  
('770e8400-e29b-41d4-a716-446655440006', '660e8400-e29b-41d4-a716-446655440003', 'Garden View Room', 'Standard', 'Peaceful room overlooking the hotel gardens', 2, 120.00, 'USD', 28, 1, '101', '["WiFi", "TV", "Air Conditioning", "Mini Bar", "Safe", "Coffee Maker", "Garden View"]'),
('770e8400-e29b-41d4-a716-446655440007', '660e8400-e29b-41d4-a716-446655440003', 'Mountain View Suite', 'Suite', 'Spacious suite with panoramic mountain views', 3, 280.00, 'USD', 50, 2, '201', '["WiFi", "TV", "Air Conditioning", "Mini Bar", "Safe", "Coffee Maker", "Mountain View", "Fireplace", "Living Area"]');

-- =============================================
-- SAMPLE BOOKINGS
-- =============================================

INSERT INTO bookings (id, user_id, accommodation_id, status, payment_status, total_amount, currency, check_in_date, check_out_date, number_of_guests, special_requests, confirmed_at) VALUES
('880e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440010', '660e8400-e29b-41d4-a716-446655440001', 'confirmed', 'paid', 450.00, 'USD', '2024-12-15', '2024-12-18', 2, 'Late check-in requested', '2024-11-15 10:30:00'),
('880e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440011', '660e8400-e29b-41d4-a716-446655440002', 'confirmed', 'paid', 750.00, 'USD', '2024-12-20', '2024-12-23', 2, 'Honeymoon package', '2024-11-20 14:15:00'),
('880e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440012', '660e8400-e29b-41d4-a716-446655440003', 'pending', 'pending', 240.00, 'USD', '2024-12-25', '2024-12-27', 1, NULL, NULL),
('880e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440013', '660e8400-e29b-41d4-a716-446655440001', 'cancelled', 'refunded', 200.00, 'USD', '2024-11-30', '2024-12-02', 2, NULL, NULL);

-- =============================================
-- SAMPLE BOOKING ITEMS
-- =============================================

INSERT INTO booking_items (id, booking_id, room_id, quantity, unit_price) VALUES
('990e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', 1, 150.00),
('990e8400-e29b-41d4-a716-446655440002', '880e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440004', 1, 250.00),
('990e8400-e29b-41d4-a716-446655440003', '880e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440006', 1, 120.00),
('990e8400-e29b-41d4-a716-446655440004', '880e8400-e29b-41d4-a716-446655440004', '770e8400-e29b-41d4-a716-446655440002', 1, 200.00);

-- =============================================
-- SAMPLE PAYMENTS
-- =============================================

INSERT INTO payments (id, booking_id, amount, currency, status, provider, provider_reference, payment_method, description, processed_at) VALUES
('aa0e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440001', 450.00, 'USD', 'completed', 'stripe', 'pi_1234567890', 'card', 'Payment for booking #880e8400-e29b-41d4-a716-446655440001', '2024-11-15 10:35:00'),
('aa0e8400-e29b-41d4-a716-446655440002', '880e8400-e29b-41d4-a716-446655440002', 750.00, 'USD', 'completed', 'paypal', 'PAYID-ABCDEF123', 'paypal', 'Payment for booking #880e8400-e29b-41d4-a716-446655440002', '2024-11-20 14:20:00'),
('aa0e8400-e29b-41d4-a716-446655440003', '880e8400-e29b-41d4-a716-446655440004', 200.00, 'USD', 'refunded', 'stripe', 'pi_0987654321', 'card', 'Refund for cancelled booking', '2024-11-25 09:15:00');

-- =============================================
-- SAMPLE REVIEWS
-- =============================================

INSERT INTO reviews (id, booking_id, user_id, accommodation_id, rating, title, comment, is_verified, is_published) VALUES
('bb0e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440010', '660e8400-e29b-41d4-a716-446655440001', 5, 'Excellent Stay!', 'Amazing service and beautiful rooms. The staff went above and beyond to make our stay comfortable. Will definitely be back!', true, true),
('bb0e8400-e29b-41d4-a716-446655440002', '880e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440011', '660e8400-e29b-41d4-a716-446655440002', 5, 'Perfect Honeymoon Destination', 'The ocean views were breathtaking and the honeymoon package was wonderful. Thank you for making our special time so memorable!', true, true);

-- =============================================
-- SAMPLE NOTIFICATIONS
-- =============================================

INSERT INTO notifications (id, user_id, type, title, message, data) VALUES
('cc0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440010', 'booking_confirmation', 'Booking Confirmed', 'Your booking for mLodge Downtown has been confirmed.', '{"booking_id": "880e8400-e29b-41d4-a716-446655440001"}'),
('cc0e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440011', 'payment_success', 'Payment Received', 'We have received your payment for booking #880e8400-e29b-41d4-a716-446655440002.', '{"booking_id": "880e8400-e29b-41d4-a716-446655440002", "amount": 750.00}'),
('cc0e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440012', 'booking_reminder', 'Upcoming Check-in', 'Your check-in at mLodge Garden is tomorrow. We look forward to welcoming you!', '{"booking_id": "880e8400-e29b-41d4-a716-446655440003", "check_in_date": "2024-12-25"}');

-- =============================================
-- SAMPLE ROOM INVENTORY (next 30 days)
-- =============================================

-- Generate inventory for next 30 days for each room
DO $$
DECLARE
    room_record RECORD;
    current_date_val DATE := CURRENT_DATE;
    end_date_val DATE := CURRENT_DATE + INTERVAL '30 days';
    date_val DATE;
BEGIN
    FOR room_record IN SELECT id, base_price, currency FROM rooms LOOP
        date_val := current_date_val;
        WHILE date_val <= end_date_val LOOP
            INSERT INTO room_inventory (room_id, date, total_units, available_units, price, currency)
            VALUES (room_record.id, date_val, 1, 1, room_record.base_price, room_record.currency)
            ON CONFLICT (room_id, date) DO NOTHING;
            date_val := date_val + INTERVAL '1 day';
        END LOOP;
    END LOOP;
END $$;

-- Mark booked dates as unavailable
UPDATE room_inventory 
SET available_units = 0
WHERE (room_id, date) IN (
    SELECT bi.room_id, generate_series(b.check_in_date, b.check_out_date - INTERVAL '1 day', '1 day'::interval)::date
    FROM bookings b
    JOIN booking_items bi ON b.id = bi.booking_id
    WHERE b.status IN ('confirmed', 'completed')
    AND b.check_in_date >= CURRENT_DATE
);

-- =============================================
-- SAMPLE AUDIT LOGS
-- =============================================

INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, new_data, ip_address) VALUES
('dd0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440010', 'CREATE_BOOKING', 'booking', '880e8400-e29b-41d4-a716-446655440001', '{"status": "pending", "amount": 450.00}', '192.168.1.100'),
('dd0e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'UPDATE_BOOKING_STATUS', 'booking', '880e8400-e29b-41d4-a716-446655440001', '{"status": "confirmed"}', '10.0.0.1'),
('dd0e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440011', 'CREATE_PAYMENT', 'payment', 'aa0e8400-e29b-41d4-a716-446655440002', '{"amount": 750.00, "provider": "paypal"}', '203.0.113.45');