import { Router, Request, Response } from 'express';

const router = Router();

// Minimal user routes
router.get('/me', (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Get current user - not implemented' });
});

export default router;
