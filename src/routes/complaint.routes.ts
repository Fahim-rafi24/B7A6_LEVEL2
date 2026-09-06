import { Router } from 'express';
import {
    createComplaint,
    getComplaints,
    getComplaintById,
    updateComplaint,
    softDeleteComplaint,
    restoreComplaint,
    getArchivedComplaints,
    assignComplaint,
    updateStatus,
    addFeedback,
    getMyComplaints,
    getStaffAssignedComplaints,
} from '../controllers/complaint.controller';
import { authenticate, requireRoles } from '../middlewares/auth.middleware';
import { uploadComplaintPhoto } from '../middlewares/media.middleware';

const router = Router();

// ── Public & General Browsing ──
router.get('/', getComplaints);
router.get('/archived', authenticate, requireRoles('ADMIN'), getArchivedComplaints);
router.get('/my-complaints', authenticate, getMyComplaints);
router.get('/assigned-to-me', authenticate, requireRoles('STAFF', 'ADMIN'), getStaffAssignedComplaints);
router.get('/:id', getComplaintById);

// ── Citizen & Administrative Actions ──
router.post('/', authenticate, uploadComplaintPhoto, createComplaint);
router.patch('/:id', authenticate, uploadComplaintPhoto, updateComplaint);

// ── Soft Delete & Restore (Universal Table Archiving) ──
router.delete('/:id', authenticate, softDeleteComplaint);
router.post('/:id/restore', authenticate, requireRoles('ADMIN'), restoreComplaint);

// ── Workflow Management ──
router.patch('/:id/assign', authenticate, requireRoles('ADMIN'), assignComplaint);
router.patch('/:id/status', authenticate, requireRoles('STAFF', 'ADMIN'), updateStatus);
router.post('/:id/feedback', authenticate, requireRoles('CITIZEN', 'ADMIN'), addFeedback);

export default router;
