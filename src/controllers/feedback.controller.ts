import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as feedbackService from '../services/feedback.service';
import { sendSuccess, sendError } from '../utils/apiResponse.util';
import { httpStatus } from '../config/http_status';
import { getParam } from '../utils/param.util';

const createFeedbackSchema = z.object({
    citizenName: z.string().optional(),
    citizenEmail: z.string().email().optional().or(z.literal('')),
    category: z.string().optional(),
    rating: z.number().min(1).max(5).default(5),
    comment: z.string().min(3, 'Feedback comment must be at least 3 characters'),
    complaintId: z.string().optional(),
});

const updateStatusSchema = z.object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
});

// ── Public: Submit Feedback for Admin Moderation ──
export async function submitFeedback(req: Request, res: Response, next: NextFunction) {
    try {
        const validated = createFeedbackSchema.parse(req.body);
        const citizenId = req.user?.sub;

        const feedback = await feedbackService.createFeedback({
            ...validated,
            citizenId,
            citizenEmail: validated.citizenEmail || req.user?.email,
            citizenName: validated.citizenName || (req.user?.email ? req.user.email.split('@')[0] : 'Verified Citizen'),
        });

        return sendSuccess(
            res,
            feedback,
            httpStatus.CREATED,
            'Feedback submitted successfully! It will appear publicly once approved by administrators.'
        );
    } catch (err) {
        next(err);
    }
}

// ── Public: Get Approved Feedback Reviews ──
export async function getPublicFeedbacks(req: Request, res: Response, next: NextFunction) {
    try {
        const category = req.query.category as string;
        const rating = req.query.rating ? Number(req.query.rating) : undefined;

        const data = await feedbackService.getPublicApprovedFeedbacks(category, rating);
        return sendSuccess(res, data, httpStatus.OK, 'Approved feedbacks retrieved.');
    } catch (err) {
        next(err);
    }
}

// ── Admin: Get All Feedbacks with Status Filters & Search ──
export async function getAdminFeedbacks(req: Request, res: Response, next: NextFunction) {
    try {
        const status = req.query.status as string;
        const search = req.query.search as string;
        const page = req.query.page ? Number(req.query.page) : 1;
        const limit = req.query.limit ? Number(req.query.limit) : 50;

        const result = await feedbackService.getAllFeedbacksForAdmin(status, search, page, limit);
        return sendSuccess(res, result, httpStatus.OK, 'Feedbacks retrieved for moderation.');
    } catch (err) {
        next(err);
    }
}

// ── Admin: Approve / Reject Feedback ──
export async function updateFeedbackStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const id = getParam(req.params.id);
        const { status } = updateStatusSchema.parse(req.body);
        const adminUser = req.user!;

        const updated = await feedbackService.updateFeedbackStatus(id, status, {
            id: adminUser.sub,
            name: adminUser.email || 'Admin',
            role: adminUser.role,
        });

        if (!updated) {
            return sendError(res, httpStatus.NOT_FOUND, 'Feedback not found.');
        }

        return sendSuccess(res, updated, httpStatus.OK, `Feedback status updated to ${status}.`);
    } catch (err) {
        next(err);
    }
}

// ── Admin: Delete Feedback ──
export async function deleteFeedback(req: Request, res: Response, next: NextFunction) {
    try {
        const id = getParam(req.params.id);
        const adminUser = req.user!;

        const deleted = await feedbackService.deleteFeedback(id, {
            id: adminUser.sub,
            name: adminUser.email || 'Admin',
            role: adminUser.role,
        });

        if (!deleted) {
            return sendError(res, httpStatus.NOT_FOUND, 'Feedback not found.');
        }

        return sendSuccess(res, { deleted: true }, httpStatus.OK, 'Feedback record deleted.');
    } catch (err) {
        next(err);
    }
}
