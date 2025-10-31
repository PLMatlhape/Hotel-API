import { Router } from 'express';
import {
  searchAccommodations,
  getAccommodationById,
  createAccommodation,
  updateAccommodation,
  deleteAccommodation,
} from '../controllers/accommodation.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { createAccommodationValidator } from '../utils/validators.js';
import { validate } from '../middleware/validation.js';

const router = Router();

// Public: search/list accommodations
router.get('/', searchAccommodations);

// Public: get by id
router.get('/:id', getAccommodationById);

// Admin: create, update, delete — require authentication and admin role
router.post('/', protect, restrictTo('admin'), createAccommodationValidator, validate, createAccommodation);
router.put('/:id', protect, restrictTo('admin'), updateAccommodation);
router.delete('/:id', protect, restrictTo('admin'), deleteAccommodation);

export default router;
