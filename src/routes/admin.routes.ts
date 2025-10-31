import { Router, Request, Response } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { updateUserStatusValidator, uuidParamValidator } from '../utils/validators.js';

const router = Router();

// Apply admin-only middleware to all routes
router.use(protect);
router.use(restrictTo('admin'));

// =============================================
// USER MANAGEMENT ROUTES
// =============================================

// @route   GET /api/admin/users
// @desc    Get all users (admin only)
// @access  Private/Admin
router.get('/users', adminController.getAllUsers);

// @route   GET /api/admin/users/:id
// @desc    Get user by ID (admin only)
// @access  Private/Admin
router.get('/users/:id', uuidParamValidator(), validate, adminController.getUserById);

// @route   PUT /api/admin/users/:id
// @desc    Update user (admin only)
// @access  Private/Admin
router.put('/users/:id', uuidParamValidator(), validate, adminController.updateUser);

// @route   PUT /api/admin/users/:id/status
// @desc    Update user status (admin only)
// @access  Private/Admin
router.put('/users/:id/status', uuidParamValidator(), updateUserStatusValidator, validate, adminController.updateUserStatus);

// @route   GET /api/admin/bookings
// @desc    Get all bookings (admin only)
// @access  Private/Admin
router.get('/bookings', adminController.getAllBookings);

// @route   GET /api/admin/dashboard-stats
// @desc    Get dashboard statistics (admin only)
// @access  Private/Admin
router.get('/dashboard-stats', adminController.getDashboardStats);

// @route   GET /api/admin/analytics
// @desc    Get system analytics (admin only)
// @access  Private/Admin
router.get('/analytics', adminController.getSystemAnalytics);

// @route   GET /api/admin/export/bookings
// @desc    Export booking data (admin only)
// @access  Private/Admin
router.get('/export/bookings', adminController.exportBookings);

// @route   DELETE /api/admin/users/:id
// @desc    Delete user (admin only)
// @access  Private/Admin
router.delete('/users/:id', uuidParamValidator(), validate, adminController.deleteUser);

export default router;
