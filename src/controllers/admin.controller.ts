import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as adminService from '../services/admin.service';
import { sendSuccess, sendError } from '../utils/apiResponse.util';
import { httpStatus } from '../config/http_status';
import { getParam } from '../utils/param.util';

const updateRoleSchema = z.object({
    role: z.enum(['CITIZEN', 'STAFF', 'ADMIN']),
});

const createDepartmentSchema = z.object({
    name: z.string().min(2, 'Department name is required'),
    code: z.string().min(2, 'Code is required').max(10),
    description: z.string().optional(),
});

const softDeleteSchema = z.object({
    reason: z.string().optional(),
});

// ── Dashboard Metrics & SLA ──
export async function getStats(req: Request, res: Response, next: NextFunction) {
    try {
        const stats = await adminService.getAdminDashboardStats();
        return sendSuccess(res, stats, httpStatus.OK, 'Admin dashboard statistics retrieved.');
    } catch (err) {
        next(err);
    }
}

// ── Category Analytics ──
export async function getCategoryAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
        const analytics = await adminService.getCategoryAnalytics();
        return sendSuccess(res, analytics, httpStatus.OK, 'Category analytics retrieved.');
    } catch (err) {
        next(err);
    }
}

// ── Audit Logs ──
export async function getAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
        const page = req.query.page ? Number(req.query.page) : 1;
        const limit = req.query.limit ? Number(req.query.limit) : 20;

        const result = await adminService.getAuditLogs(page, limit);
        return sendSuccess(res, result, httpStatus.OK, 'System audit logs retrieved.');
    } catch (err) {
        next(err);
    }
}

// ── User Management ──
export async function getUsers(req: Request, res: Response, next: NextFunction) {
    try {
        const page = req.query.page ? Number(req.query.page) : 1;
        const limit = req.query.limit ? Number(req.query.limit) : 20;
        const role = req.query.role as string;

        const result = await adminService.getAllUsers(page, limit, role);
        return sendSuccess(res, result, httpStatus.OK, 'User list retrieved.');
    } catch (err) {
        next(err);
    }
}

export async function updateUserRole(req: Request, res: Response, next: NextFunction) {
    try {
        const id = getParam(req.params.id);
        const { role } = updateRoleSchema.parse(req.body);
        const adminUser = req.user!;

        const updated = await adminService.updateUserRole(
            id,
            role,
            { id: adminUser.sub, name: adminUser.email || 'Admin', role: adminUser.role }
        );

        if (!updated) {
            return sendError(res, httpStatus.NOT_FOUND, 'User not found.');
        }

        return sendSuccess(res, updated, httpStatus.OK, 'User role updated.');
    } catch (err) {
        next(err);
    }
}

// ── Soft Delete User to users_del ──
export async function softDeleteUser(req: Request, res: Response, next: NextFunction) {
    try {
        const id = getParam(req.params.id);
        const { reason } = softDeleteSchema.parse(req.body || {});
        const adminUser = req.user!;

        const archived = await adminService.softDeleteUser(
            id,
            { id: adminUser.sub, name: adminUser.email || 'Admin', role: adminUser.role },
            reason
        );

        if (!archived) {
            return sendError(res, httpStatus.NOT_FOUND, 'User not found.');
        }

        return sendSuccess(res, archived, httpStatus.OK, 'User soft-deleted and archived in users_del.');
    } catch (err) {
        next(err);
    }
}

// ── Department Management ──
export async function getDepartments(req: Request, res: Response, next: NextFunction) {
    try {
        const departments = await adminService.getDepartments();
        return sendSuccess(res, departments, httpStatus.OK, 'Departments retrieved.');
    } catch (err) {
        next(err);
    }
}

export async function createDepartment(req: Request, res: Response, next: NextFunction) {
    try {
        const { name, code, description } = createDepartmentSchema.parse(req.body);
        const adminUser = req.user!;

        const dept = await adminService.createDepartment(
            name,
            code,
            description,
            { id: adminUser.sub, name: adminUser.email || 'Admin', role: adminUser.role }
        );

        return sendSuccess(res, dept, httpStatus.CREATED, 'Department created.');
    } catch (err) {
        next(err);
    }
}

// ── Soft Delete Department to departments_del ──
export async function softDeleteDepartment(req: Request, res: Response, next: NextFunction) {
    try {
        const id = getParam(req.params.id);
        const { reason } = softDeleteSchema.parse(req.body || {});
        const adminUser = req.user!;

        const archived = await adminService.softDeleteDepartment(
            id,
            { id: adminUser.sub, name: adminUser.email || 'Admin', role: adminUser.role },
            reason
        );

        if (!archived) {
            return sendError(res, httpStatus.NOT_FOUND, 'Department not found.');
        }

        return sendSuccess(res, archived, httpStatus.OK, 'Department soft-deleted and archived in departments_del.');
    } catch (err) {
        next(err);
    }
}
