import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import * as authService from '../services/auth.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// =============================================
// REGISTER USER
// =============================================
export const register = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, name, password, phone } = req.body;

    const { user, accessToken, refreshToken } = await authService.registerUser(
      email,
      name,
      password,
      phone
    );

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
        },
        accessToken,
        refreshToken,
      },
    });
  }
);

// =============================================
// LOGIN USER
// =============================================
export const login = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;

    const { user, accessToken, refreshToken } = await authService.loginUser(
      email,
      password
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
        },
        accessToken,
        refreshToken,
      },
    });
  }
);

// =============================================
// GET CURRENT USER
// =============================================
export const getCurrentUser = asyncHandler(
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
      },
    });
  }
);

// =============================================
// LOGOUT (Client-side token removal)
// =============================================
export const logout = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    return res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  }
);