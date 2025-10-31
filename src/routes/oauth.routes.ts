import { Router } from 'express';
import * as oauthController from '../controllers/oauth.controller.js';

const router = Router();

// =============================================
// GOOGLE OAUTH ROUTES
// =============================================

// @route   GET /api/oauth/google
// @desc    Initiate Google OAuth login
// @access  Public
router.get('/google', oauthController.initiateGoogleAuth);

// @route   GET /api/oauth/google/callback
// @desc    Handle Google OAuth callback
// @access  Public
router.get('/google/callback', oauthController.handleGoogleCallback);

// =============================================
// FACEBOOK OAUTH ROUTES
// =============================================

// @route   GET /api/oauth/facebook
// @desc    Initiate Facebook OAuth login
// @access  Public
router.get('/facebook', oauthController.initiateFacebookAuth);

// @route   GET /api/oauth/facebook/callback
// @desc    Handle Facebook OAuth callback
// @access  Public
router.get('/facebook/callback', oauthController.handleFacebookCallback);

// =============================================
// OAUTH LINKING ROUTES
// =============================================

// @route   POST /api/oauth/link/google
// @desc    Link Google account to existing user
// @access  Private
router.post('/link/google', oauthController.linkGoogleAccount);

// @route   POST /api/oauth/link/facebook
// @desc    Link Facebook account to existing user
// @access  Private
router.post('/link/facebook', oauthController.linkFacebookAccount);

// @route   DELETE /api/oauth/unlink/:provider
// @desc    Unlink OAuth provider from account
// @access  Private
router.delete('/unlink/:provider', oauthController.unlinkProvider);

export default router;