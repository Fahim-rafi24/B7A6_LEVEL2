import { Router } from 'express';
import {
    submitFeedback,
    getPublicFeedbacks,
    getAdminFeedbacks,
    updateFeedbackStatus,
    deleteFeedback,
} from '../controllers/feedback.controller';
import { authenticate, optionalAuth, requireRoles } from '../middlewares/auth.middleware';

const router = Router();

// ── Public Routes ──
router.get('/', getPublicFeedbacks);
router.post('/', optionalAuth, submitFeedback);

// ── Admin Protected Routes ──
router.get('/admin', authenticate, requireRoles('ADMIN'), getAdminFeedbacks);
router.patch('/:id/status', authenticate, requireRoles('ADMIN'), updateFeedbackStatus);
router.delete('/:id', authenticate, requireRoles('ADMIN'), deleteFeedback);

export default router;
