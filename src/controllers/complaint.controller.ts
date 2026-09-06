import { Request, Response, NextFunction } from 'express';
import {
    createComplaintSchema,
    updateComplaintSchema,
    assignComplaintSchema,
    updateStatusSchema,
    feedbackSchema,
    softDeleteSchema,
} from '../validators/complaint.validator';
import * as complaintService from '../services/complaint.service';
import { sendSuccess, sendError } from '../utils/apiResponse.util';
import { httpStatus } from '../config/http_status';
import { getParam } from '../utils/param.util';

// ── Submit Complaint ──
export async function createComplaint(req: Request, res: Response, next: NextFunction) {
    try {
        const validated = createComplaintSchema.parse(req.body);
        const user = req.user!;

        let imageUrl = validated.imageUrl;
        if (req.file) {
            imageUrl = `/uploads/img/${req.file.filename}`;
        }

        const complaint = await complaintService.createComplaint({
            ...validated,
            imageUrl,
            citizenId: user.sub,
            citizenName: user.email || 'Citizen User',
            citizenRole: user.role,
        });

        return sendSuccess(res, complaint, httpStatus.CREATED, 'Complaint registered successfully.');
    } catch (err) {
        next(err);
    }
}

// ── Browse Complaints (Search, Filter, Pagination) ──
export async function getComplaints(req: Request, res: Response, next: NextFunction) {
    try {
        const {
            page,
            limit,
            search,
            category,
            status,
            priority,
            departmentId,
            citizenId,
            assignedStaffId,
            isPremiumService,
            sortBy,
            sortOrder,
        } = req.query;

        const result = await complaintService.getComplaints({
            page: page ? Number(page) : 1,
            limit: limit ? Number(limit) : 10,
            search: search as string,
            category: category as string,
            status: status as string,
            priority: priority as string,
            departmentId: departmentId as string,
            citizenId: citizenId as string,
            assignedStaffId: assignedStaffId as string,
            isPremiumService: isPremiumService !== undefined ? isPremiumService === 'true' : undefined,
            sortBy: sortBy as string,
            sortOrder: sortOrder as 'asc' | 'desc',
        });

        return sendSuccess(res, result, httpStatus.OK, 'Complaints retrieved.');
    } catch (err) {
        next(err);
    }
}

// ── Single Complaint Details & Timeline ──
export async function getComplaintById(req: Request, res: Response, next: NextFunction) {
    try {
        const id = getParam(req.params.id);
        const complaint = await complaintService.getComplaintById(id);

        if (!complaint) {
            return sendError(res, httpStatus.NOT_FOUND, `Complaint with identifier '${id}' was not found.`);
        }

        return sendSuccess(res, complaint, httpStatus.OK, 'Complaint details retrieved.');
    } catch (err) {
        next(err);
    }
}

// ── Update Complaint ──
export async function updateComplaint(req: Request, res: Response, next: NextFunction) {
    try {
        const id = getParam(req.params.id);
        const validated = updateComplaintSchema.parse(req.body);
        const user = req.user!;

        const existing = await complaintService.getComplaintById(id);
        if (!existing) {
            return sendError(res, httpStatus.NOT_FOUND, 'Complaint not found.');
        }

        // Only author or admin can edit
        if (existing.citizenId !== user.sub && user.role.toUpperCase() !== 'ADMIN') {
            return sendError(res, httpStatus.FORBIDDEN, 'You do not have permission to edit this complaint.');
        }

        let imageUrl = validated.imageUrl;
        if (req.file) {
            imageUrl = `/uploads/img/${req.file.filename}`;
        }

        const updated = await complaintService.updateComplaint(
            id,
            { ...validated, imageUrl },
            { id: user.sub, name: user.email || 'User', role: user.role }
        );

        return sendSuccess(res, updated, httpStatus.OK, 'Complaint updated.');
    } catch (err) {
        next(err);
    }
}

// ── Soft Delete: moves from complaints_info to complaints_info_del ──
export async function softDeleteComplaint(req: Request, res: Response, next: NextFunction) {
    try {
        const id = getParam(req.params.id);
        const { reason } = softDeleteSchema.parse(req.body || {});
        const user = req.user!;

        const existing = await complaintService.getComplaintById(id);
        if (!existing) {
            return sendError(res, httpStatus.NOT_FOUND, 'Complaint not found or already deleted.');
        }

        // Only author or admin can delete
        if (existing.citizenId !== user.sub && user.role.toUpperCase() !== 'ADMIN') {
            return sendError(res, httpStatus.FORBIDDEN, 'Permission denied. Only author or Admin can delete complaints.');
        }

        const archived = await complaintService.softDeleteComplaint(
            id,
            { id: user.sub, name: user.email || 'User', role: user.role },
            reason
        );

        return sendSuccess(
            res,
            archived,
            httpStatus.OK,
            'Complaint soft-deleted successfully and archived in complaints_info_del table.'
        );
    } catch (err) {
        next(err);
    }
}

// ── Restore Complaint from complaints_info_del back to complaints_info ──
export async function restoreComplaint(req: Request, res: Response, next: NextFunction) {
    try {
        const id = getParam(req.params.id);
        const user = req.user!;

        const restored = await complaintService.restoreComplaint(
            id,
            { id: user.sub, name: user.email || 'Admin', role: user.role }
        );

        if (!restored) {
            return sendError(res, httpStatus.NOT_FOUND, 'Archived complaint record not found in complaints_info_del.');
        }

        return sendSuccess(res, restored, httpStatus.OK, 'Complaint restored to active complaints_info table.');
    } catch (err) {
        next(err);
    }
}

// ── View Archived Complaints (Admin only) ──
export async function getArchivedComplaints(req: Request, res: Response, next: NextFunction) {
    try {
        const page = req.query.page ? Number(req.query.page) : 1;
        const limit = req.query.limit ? Number(req.query.limit) : 10;

        const result = await complaintService.getArchivedComplaints(page, limit);
        return sendSuccess(res, result, httpStatus.OK, 'Archived complaints from complaints_info_del retrieved.');
    } catch (err) {
        next(err);
    }
}

// ── Assign Department / Staff (Admin only) ──
export async function assignComplaint(req: Request, res: Response, next: NextFunction) {
    try {
        const id = getParam(req.params.id);
        const { departmentId, assignedStaffId } = assignComplaintSchema.parse(req.body);
        const user = req.user!;

        const updated = await complaintService.assignComplaint(
            id,
            departmentId,
            assignedStaffId || null,
            { id: user.sub, name: user.email || 'Admin', role: user.role }
        );

        if (!updated) {
            return sendError(res, httpStatus.NOT_FOUND, 'Complaint not found.');
        }

        return sendSuccess(res, updated, httpStatus.OK, 'Complaint successfully assigned.');
    } catch (err) {
        next(err);
    }
}

// ── Update Status & Timeline (Staff / Admin) ──
export async function updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const id = getParam(req.params.id);
        const { status, content, desc } = updateStatusSchema.parse(req.body);
        const user = req.user!;

        const updated = await complaintService.updateComplaintStatus(
            id,
            status,
            content,
            desc,
            { id: user.sub, name: user.email || 'Staff', role: user.role }
        );

        if (!updated) {
            return sendError(res, httpStatus.NOT_FOUND, 'Complaint not found.');
        }

        return sendSuccess(res, updated, httpStatus.OK, `Complaint status updated to ${status}.`);
    } catch (err) {
        next(err);
    }
}

// ── Add Feedback / Review (Citizen) ──
export async function addFeedback(req: Request, res: Response, next: NextFunction) {
    try {
        const id = getParam(req.params.id);
        const { rating, comment } = feedbackSchema.parse(req.body);
        const user = req.user!;

        const feedback = await complaintService.addComplaintFeedback(
            id,
            user.sub,
            user.email || 'Citizen',
            rating,
            comment
        );

        if (!feedback) {
            return sendError(res, httpStatus.NOT_FOUND, 'Complaint not found.');
        }

        return sendSuccess(res, feedback, httpStatus.CREATED, 'Feedback recorded. Thank you for rating!');
    } catch (err) {
        next(err);
    }
}

// ── My Complaints (Citizen) ──
export async function getMyComplaints(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!;
        const page = req.query.page ? Number(req.query.page) : 1;
        const limit = req.query.limit ? Number(req.query.limit) : 10;

        const result = await complaintService.getComplaints({
            citizenId: user.sub,
            page,
            limit,
        });

        return sendSuccess(res, result, httpStatus.OK, 'Your complaints retrieved.');
    } catch (err) {
        next(err);
    }
}

// ── Staff Assigned Complaints (Staff) ──
export async function getStaffAssignedComplaints(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!;
        const page = req.query.page ? Number(req.query.page) : 1;
        const limit = req.query.limit ? Number(req.query.limit) : 10;

        const result = await complaintService.getComplaints({
            assignedStaffId: user.sub,
            page,
            limit,
        });

        return sendSuccess(res, result, httpStatus.OK, 'Assigned complaints retrieved.');
    } catch (err) {
        next(err);
    }
}
