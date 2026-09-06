import { Router } from 'express';
import {
    getStats,
    getCategoryAnalytics,
    getAuditLogs,
    getUsers,
    updateUserRole,
    softDeleteUser,
    getDepartments,
    createDepartment,
    softDeleteDepartment,
} from '../controllers/admin.controller';
import { authenticate, requireRoles } from '../middlewares/auth.middleware';

const router = Router();

// All admin routes require Authentication and ADMIN role
router.use(authenticate, requireRoles('ADMIN'));

// ── Analytics & Stats ──
router.get('/dashboard-stats', getStats);
router.get('/category-analytics', getCategoryAnalytics);
router.get('/audit-logs', getAuditLogs);

// ── User Management & Soft Deletion ──
router.get('/users', getUsers);
router.patch('/users/:id/role', updateUserRole);
router.delete('/users/:id', softDeleteUser);

// ── Department Management & Soft Deletion ──
router.get('/departments', getDepartments);
router.post('/departments', createDepartment);
router.delete('/departments/:id', softDeleteDepartment);

export default router;
