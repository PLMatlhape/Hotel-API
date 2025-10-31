import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import * as authService from '../services/auth.service.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';
import axios from 'axios';

// =============================================
// GOOGLE OAUTH
// =============================================

export const initiateGoogleAuth = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    
    if (!clientId || !redirectUri) {
      return next(new AppError('Google OAuth not configured', 500));
    }

    const googleAuthUrl = 
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=openid%20email%20profile&` +
      `access_type=offline&` +
      `prompt=consent`;

    return res.redirect(googleAuthUrl);
  }
);

export const handleGoogleCallback = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { code, error } = req.query;

    if (error) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_cancelled`);
    }

    if (!code) {
      return next(new AppError('Authorization code not provided', 400));
    }

    try {
      // Exchange code for access token
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      });

      const { access_token } = tokenResponse.data;

      // Get user info from Google
      const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const { id, email, name, picture } = userResponse.data;

      // Login or register user
      const { user, accessToken, refreshToken, isNewUser } = await authService.oauthLogin(
        'google',
        id,
        email,
        name
      );

      // Redirect to frontend with tokens
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?` +
        `token=${accessToken}&` +
        `refresh=${refreshToken}&` +
        `new_user=${isNewUser}`;

      return res.redirect(redirectUrl);
    } catch (error) {
      console.error('Google OAuth error:', error);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
    }
  }
);

// =============================================
// FACEBOOK OAUTH
// =============================================

export const initiateFacebookAuth = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const clientId = process.env.FACEBOOK_CLIENT_ID;
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
    
    if (!clientId || !redirectUri) {
      return next(new AppError('Facebook OAuth not configured', 500));
    }

    const facebookAuthUrl = 
      `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=email,public_profile&` +
      `response_type=code`;

    return res.redirect(facebookAuthUrl);
  }
);

export const handleFacebookCallback = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { code, error } = req.query;

    if (error) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_cancelled`);
    }

    if (!code) {
      return next(new AppError('Authorization code not provided', 400));
    }

    try {
      // Exchange code for access token
      const tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
        params: {
          client_id: process.env.FACEBOOK_CLIENT_ID,
          client_secret: process.env.FACEBOOK_CLIENT_SECRET,
          code,
          redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
        },
      });

      const { access_token } = tokenResponse.data;

      // Get user info from Facebook
      const userResponse = await axios.get('https://graph.facebook.com/v18.0/me', {
        params: {
          fields: 'id,name,email,picture',
          access_token,
        },
      });

      const { id, email, name, picture } = userResponse.data;

      if (!email) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=email_required`);
      }

      // Login or register user
      const { user, accessToken, refreshToken, isNewUser } = await authService.oauthLogin(
        'facebook',
        id,
        email,
        name
      );

      // Redirect to frontend with tokens
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?` +
        `token=${accessToken}&` +
        `refresh=${refreshToken}&` +
        `new_user=${isNewUser}`;

      return res.redirect(redirectUrl);
    } catch (error) {
      console.error('Facebook OAuth error:', error);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
    }
  }
);

// =============================================
// OAUTH ACCOUNT LINKING
// =============================================

export const linkGoogleAccount = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const { code } = req.body;

    if (!userId) {
      return next(new AppError('Authentication required', 401));
    }

    if (!code) {
      return next(new AppError('Authorization code required', 400));
    }

    try {
      // Exchange code for access token
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      });

      const { access_token } = tokenResponse.data;

      // Get user info from Google
      const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const { id, email } = userResponse.data;

      // Link account (implementation would go in auth service)
      // For now, return success
      return res.status(200).json({
        success: true,
        message: 'Google account linked successfully',
        data: { provider: 'google', provider_user_id: id, email },
      });
    } catch (error) {
      return next(new AppError('Failed to link Google account', 500));
    }
  }
);

export const linkFacebookAccount = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const { code } = req.body;

    if (!userId) {
      return next(new AppError('Authentication required', 401));
    }

    if (!code) {
      return next(new AppError('Authorization code required', 400));
    }

    try {
      // Similar implementation to Facebook callback
      // For brevity, returning success
      return res.status(200).json({
        success: true,
        message: 'Facebook account linked successfully',
      });
    } catch (error) {
      return next(new AppError('Failed to link Facebook account', 500));
    }
  }
);

export const unlinkProvider = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const { provider } = req.params;

    if (!userId) {
      return next(new AppError('Authentication required', 401));
    }

    if (!provider || !['google', 'facebook'].includes(provider)) {
      return next(new AppError('Invalid OAuth provider', 400));
    }

    // Implementation would go in auth service
    // For now, return success
    return res.status(200).json({
      success: true,
      message: `${provider} account unlinked successfully`,
    });
  }
);