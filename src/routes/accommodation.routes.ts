import { Router } from 'express';
import {
  searchAccommodations,
  getAccommodationById,
  createAccommodation,
  updateAccommodation,
  deleteAccommodation,
  createRoom,
  updateRoom,
  getRoomById,
  deleteRoom,
  getAllRoomsAdmin,
  getRoomsByAccommodationId,
} from '../controllers/accommodation.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { createAccommodationValidator, createRoomForAccommodationValidator } from '../utils/validators.js';
import { validate } from '../middleware/validation.js';
import { uploadMultiple } from '../middleware/upload.js';

const router = Router();

// Public: search/list accommodations
router.get('/', searchAccommodations);

// Public: get by id
router.get('/:id', getAccommodationById);

// Public: get room by id
router.get('/rooms/:roomId', getRoomById);

// Admin: get all rooms
router.get('/admin/rooms', protect, restrictTo('admin'), getAllRoomsAdmin);

// Public: get rooms by accommodation id
router.get('/:accommodationId/rooms', getRoomsByAccommodationId);

// Admin: create, update, delete — require authentication and admin role with image upload
router.post('/', protect, restrictTo('admin'), uploadMultiple, createAccommodationValidator, validate, createAccommodation);
router.put('/:id', protect, restrictTo('admin'), uploadMultiple, updateAccommodation);
router.delete('/:id', protect, restrictTo('admin'), deleteAccommodation);

// Admin: create room for accommodation with image upload
router.post('/:accommodationId/rooms', protect, restrictTo('admin'), uploadMultiple, createRoomForAccommodationValidator, validate, createRoom);

// Admin: update room with image upload
router.put('/rooms/:roomId', protect, restrictTo('admin'), uploadMultiple, updateRoom);

// Admin: delete room
router.delete('/rooms/:roomId', protect, restrictTo('admin'), deleteRoom);

export default router;
