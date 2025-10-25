import { Router, Request, Response } from 'express';

const router = Router();

// Minimal booking route stubs
router.post('/', (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Create booking - not implemented' });
});

router.get('/:id', (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Get booking - not implemented' });
});

export default router;
