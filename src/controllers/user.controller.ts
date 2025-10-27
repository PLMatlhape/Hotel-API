import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import * as authService from '../services/auth.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import bcrypt from 'bcryptjs';

// =============================================
// GET USER PROFILE
// =============================================
export const getUserProfile = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const user = await authService.getUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  }
);

// =============================================
// UPDATE USER PROFILE
// =============================================
export const updateUserProfile = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { name, phone } = req.body;

    // Validate input
    if (!name && !phone) {
      return res.status(400).json({
        success: false,
        error: 'At least one field (name or phone) must be provided',
      });
    }

    // Update user profile
    const updatedUser = await authService.updateUserProfile(userId, { name, phone });

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        phone: updatedUser.phone,
        role: updatedUser.role,
        created_at: updatedUser.created_at,
        updated_at: updatedUser.updated_at,
      },
    });
  }
);

// =============================================
// UPDATE USER PASSWORD
// =============================================
export const updateUserPassword = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters long',
      });
    }

    // Get user with password hash
    const user = await authService.getUserByIdWithPassword(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Check if user has a password (OAuth users might not)
    if (!user.password_hash) {
      return res.status(400).json({
        success: false,
        error: 'Password update not available for OAuth users',
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect',
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    const updatedUser = await authService.updateUserPassword(userId, hashedNewPassword);

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  }
);

// =============================================
// DELETE USER ACCOUNT
// =============================================
export const deleteUserAccount = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { password } = req.body;

    // Validate input
    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required to delete account',
      });
    }

    // Get user with password hash
    const user = await authService.getUserByIdWithPassword(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Check if user has a password (OAuth users might not)
    if (!user.password_hash) {
      return res.status(400).json({
        success: false,
        error: 'Account deletion not available for OAuth users',
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Password is incorrect',
      });
    }

    // Delete user account
    const deletedUser = await authService.deleteUserAccount(userId);

    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
    });
  }
);
