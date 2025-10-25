import { Router, Request, Response } from 'express';

const router = Router();

// Minimal payment route stubs
router.post('/intent', (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Create payment intent - not implemented' });
});

router.post('/webhook', (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Webhook handling - not implemented' });
});

export default router;
