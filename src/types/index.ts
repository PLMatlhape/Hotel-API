import { Request } from 'express';

// =============================================
// USER INTERFACES
// =============================================
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  password_hash?: string;
  role: 'user' | 'admin';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// =============================================
// ACCOMMODATION INTERFACES
// =============================================
export interface Accommodation {
  id: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  country: string;
  star_rating?: number;
  latitude?: number;
  longitude?: number;
  owner_id: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Room {
  id: string;
  accommodation_id: string;
  type_name: string;
  description?: string;
  base_price: number;
  max_guests: number;
  room_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface SearchFilters {
  city?: string;
  country?: string;
  checkin_date?: string;
  checkout_date?: string;
  guest_count?: number;
  min_price?: number;
  max_price?: number;
  star_rating?: number;
  amenities?: string[];
  page?: number;
  limit?: number;
}

// =============================================
// BOOKING INTERFACES
// =============================================
export interface Booking {
  id: string;
  user_id: string;
  accommodation_id: string;
  room_type_id: string;
  checkin_date: Date;
  checkout_date: Date;
  guest_count: number;
  total_amount: number;
  booking_status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  special_requests?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateBookingDTO {
  accommodation_id: string;
  checkin_date: string;
  checkout_date: string;
  guest_count: number;
  // rooms: array of room bookings with quantity
  rooms: Array<{
    room_id: string;
    quantity: number;
  }>;
  // optional notes for the booking
  notes?: string;
}


// =============================================
// PAYMENT INTERFACES
// =============================================
export interface Payment {
  id: string;
  booking_id: string;
  user_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
  stripe_payment_intent_id?: string;
  transaction_id?: string;
  created_at: Date;
  updated_at: Date;
}

// =============================================
// OAUTH INTERFACES
// =============================================
export interface OAuthProvider {
  id: string;
  user_id: string;
  provider: 'google' | 'facebook' | 'apple';
  provider_user_id: string;
  created_at: Date;
}

// =============================================
// REVIEW INTERFACES
// =============================================
export interface Review {
  id: string;
  user_id: string;
  accommodation_id: string;
  booking_id?: string;
  rating: number;
  title?: string;
  comment?: string;
  created_at: Date;
  updated_at: Date;
}

// =============================================
// NOTIFICATION INTERFACES
// =============================================
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'booking' | 'payment' | 'review' | 'system';
  is_read: boolean;
  created_at: Date;
}

// =============================================
// AMENITY INTERFACES
// =============================================
export interface Amenity {
  id: string;
  name: string;
  icon?: string;
  category: string;
  created_at: Date;
}

// =============================================
// API RESPONSE INTERFACES
// =============================================
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// =============================================
// DATABASE INTERFACES
// =============================================
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

// =============================================
// ERROR INTERFACES
// =============================================
export interface CustomError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}