import { body, query, param, ValidationChain } from 'express-validator';

// =============================================
// AUTH VALIDATORS
// =============================================
export const registerValidator: ValidationChain[] = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('phone')
    .optional()
    .isLength({ min: 10, max: 10 })
    .isNumeric()
    .withMessage('Please provide a valid 10-digit phone number'),
];

export const loginValidator: ValidationChain[] = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

// =============================================
// ACCOMMODATION VALIDATORS
// =============================================
export const createAccommodationValidator: ValidationChain[] = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Accommodation name is required')
    .isLength({ max: 200 })
    .withMessage('Name must not exceed 200 characters'),
  body('address')
    .trim()
    .notEmpty()
    .withMessage('Address is required'),
  body('city')
    .trim()
    .notEmpty()
    .withMessage('City is required'),
  body('country')
    .trim()
    .notEmpty()
    .withMessage('Country is required'),
  body('postal_code')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Postal code must not exceed 20 characters'),
  body('star_rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Star rating must be between 1 and 5'),
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
  body('photos')
    .optional()
    .isArray()
    .withMessage('Photos must be an array'),
  body('photos.*.url')
    .optional()
    .isURL()
    .withMessage('Each photo must have a valid URL'),
  body('photos.*.caption')
    .optional()
    .isString()
    .withMessage('Photo caption must be a string'),
  body('amenities')
    .optional()
    .isObject()
    .withMessage('Amenities must be an object with categories'),
  body('amenities.*')
    .optional()
    .isArray()
    .withMessage('Each amenity category must be an array'),
];

export const searchAccommodationValidator: ValidationChain[] = [
  query('city').optional().trim(),
  query('country').optional().trim(),
  query('checkin_date')
    .optional()
    .isISO8601()
    .withMessage('Invalid check-in date format'),
  query('checkout_date')
    .optional()
    .isISO8601()
    .withMessage('Invalid check-out date format'),
  query('guest_count')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Guest count must be at least 1'),
  query('min_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum price must be a positive number'),
  query('max_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum price must be a positive number'),
  query('star_rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Star rating must be between 1 and 5'),
];

// =============================================
// BOOKING VALIDATORS
// =============================================
export const createBookingValidator: ValidationChain[] = [
  body('accommodation_id')
    .notEmpty()
    .withMessage('Accommodation ID is required')
    .isUUID()
    .withMessage('Invalid accommodation ID'),
  body('room_type_id')
    .notEmpty()
    .withMessage('Room type ID is required')
    .isUUID()
    .withMessage('Invalid room type ID'),
  body('checkin_date')
    .notEmpty()
    .withMessage('Check-in date is required')
    .isISO8601()
    .withMessage('Invalid check-in date format'),
  body('checkout_date')
    .notEmpty()
    .withMessage('Check-out date is required')
    .isISO8601()
    .withMessage('Invalid check-out date format'),
  body('guest_count')
    .notEmpty()
    .withMessage('Guest count is required')
    .isInt({ min: 1 })
    .withMessage('Guest count must be at least 1'),
];

// =============================================
// ROOM VALIDATORS
// =============================================
export const createRoomValidator: ValidationChain[] = [
  body('accommodation_id')
    .notEmpty()
    .withMessage('Accommodation ID is required')
    .isUUID()
    .withMessage('Invalid accommodation ID'),
  body('type_name')
    .trim()
    .notEmpty()
    .withMessage('Room type name is required'),
  body('price_per_night')
    .isFloat({ min: 0 })
    .withMessage('Price per night must be a positive number'),
  body('max_guests')
    .isInt({ min: 1 })
    .withMessage('Maximum guests must be at least 1'),
];

export const createRoomForAccommodationValidator: ValidationChain[] = [
  param('accommodationId')
    .isUUID()
    .withMessage('Invalid accommodation ID'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Room name is required')
    .isLength({ max: 100 })
    .withMessage('Room name must not exceed 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('capacity')
    .isInt({ min: 1 })
    .withMessage('Capacity must be at least 1'),
  body('beds')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Beds must be at least 1'),
  body('price_per_night')
    .isFloat({ min: 0 })
    .withMessage('Price per night must be a positive number'),
  body('refundable')
    .optional()
    .isBoolean()
    .withMessage('Refundable must be a boolean value'),
];

// =============================================
// REVIEW VALIDATORS
// =============================================
export const createReviewValidator: ValidationChain[] = [
  body('accommodation_id')
    .notEmpty()
    .withMessage('Accommodation ID is required')
    .isUUID()
    .withMessage('Invalid accommodation ID'),
  body('rating')
    .notEmpty()
    .withMessage('Rating is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('title')
    .optional()
    .trim()
    .isLength({ max: 150 })
    .withMessage('Title must not exceed 150 characters'),
  body('comment')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Comment must not exceed 1000 characters'),
];

// =============================================
// PAYMENT VALIDATORS
// =============================================
export const createPaymentValidator: ValidationChain[] = [
  body('booking_id')
    .notEmpty()
    .withMessage('Booking ID is required')
    .isUUID()
    .withMessage('Invalid booking ID'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  body('payment_method')
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(['card', 'stripe'])
    .withMessage('Invalid payment method'),
];

// =============================================
// ADMIN USER UPDATE VALIDATOR
// =============================================
export const updateUserByAdminValidator: ValidationChain[] = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('phone')
    .optional()
    .isLength({ min: 10, max: 10 })
    .isNumeric()
    .withMessage('Please provide a valid 10-digit phone number'),
];

// =============================================
// ADMIN USER STATUS UPDATE VALIDATOR
// =============================================
export const updateUserStatusValidator: ValidationChain[] = [
  body('is_active')
    .isBoolean()
    .withMessage('is_active must be a boolean value'),
];

// =============================================
// UUID PARAM VALIDATOR
// =============================================
export const uuidParamValidator = (paramName: string = 'id'): ValidationChain[] => [
  param(paramName)
    .isUUID()
    .withMessage(`Invalid ${paramName}`),
];
