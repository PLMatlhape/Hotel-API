import { Router, Request, Response } from 'express';

const router = Router();

// Minimal stub routes for accommodations
router.get('/', (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Accommodations routes not implemented yet' });
});

router.get('/:id', (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Not implemented' });
});

export default router;
