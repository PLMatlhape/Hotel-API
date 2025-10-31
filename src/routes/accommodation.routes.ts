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

// Admin: create, update, delete — require authentication and admin role
router.post('/', protect, restrictTo('admin'), createAccommodationValidator, validate, createAccommodation);
router.put('/:id', protect, restrictTo('admin'), updateAccommodation);
router.delete('/:id', protect, restrictTo('admin'), deleteAccommodation);

// Admin: create room for accommodation
router.post('/:accommodationId/rooms', protect, restrictTo('admin'), createRoomForAccommodationValidator, validate, createRoom);

// Admin: update room
router.put('/rooms/:roomId', protect, restrictTo('admin'), updateRoom);

// Admin: delete room
router.delete('/rooms/:roomId', protect, restrictTo('admin'), deleteRoom);

export default router;
