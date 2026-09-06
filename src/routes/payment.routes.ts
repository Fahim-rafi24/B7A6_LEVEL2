import { Router } from 'express';
import {
    initiatePayment,
    verifyPayment,
    handleWebhook,
    getMyPayments,
    softDeletePayment,
} from '../controllers/payment.controller';
import { authenticate, requireRoles } from '../middlewares/auth.middleware';
import { authLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

// ── Payment Operations ──
router.post('/initiate', authenticate, authLimiter, initiatePayment);
router.get('/verify', verifyPayment);
router.post('/webhook', handleWebhook);
router.get('/my-payments', authenticate, getMyPayments);

// ── Soft Delete Payment Archive ──
router.delete('/:id', authenticate, requireRoles('ADMIN'), softDeletePayment);

export default router;
