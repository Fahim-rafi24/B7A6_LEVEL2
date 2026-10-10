import { Router } from 'express';
import {
    submitContact,
    getAdminContacts,
    markChecked,
    updateStatus,
    replyContact,
    deleteContact,
} from '../controllers/contact.controller';
import { authenticate, requireRoles } from '../middlewares/auth.middleware';

const router = Router();

// ── Public Contact Submission ──
router.post('/', submitContact);

// ── Protected Admin Inquiries Management ──
router.get('/admin', authenticate, requireRoles('ADMIN'), getAdminContacts);
router.patch('/:id/check', authenticate, requireRoles('ADMIN'), markChecked);
router.patch('/:id/status', authenticate, requireRoles('ADMIN'), updateStatus);
router.post('/:id/reply', authenticate, requireRoles('ADMIN'), replyContact);
router.delete('/:id', authenticate, requireRoles('ADMIN'), deleteContact);

export default router;
