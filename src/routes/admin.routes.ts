import { Router, Request, Response } from 'express';

const router = Router();

// Admin stubs
router.get('/', (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Admin routes not implemented' });
});

export default router;
