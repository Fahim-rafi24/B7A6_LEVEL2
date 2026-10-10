import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as contactService from '../services/contact.service';
import { sendSuccess, sendError } from '../utils/apiResponse.util';
import { httpStatus } from '../config/http_status';
import { getParam } from '../utils/param.util';

const submitContactSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Valid email is required'),
    phone: z.string().optional(),
    subject: z.string().min(1, 'Subject is required'),
    message: z.string().min(5, 'Message must be at least 5 characters long'),
});

const updateStatusSchema = z.object({
    status: z.enum(['UNCHECKED', 'CHECKED_BY_ME', 'CHECKED_BY_OTHER']),
});

const replySchema = z.object({
    replyMessage: z.string().min(1, 'Reply message cannot be empty'),
});

// ── Public: Submit Citizen Contact Inquiry ──
export async function submitContact(req: Request, res: Response, next: NextFunction) {
    try {
        const validated = submitContactSchema.parse(req.body);
        const contact = await contactService.createContactInquiry(validated);

        return sendSuccess(
            res,
            contact,
            httpStatus.CREATED,
            'Inquiry received successfully! Our municipal support desk will get back to you shortly.'
        );
    } catch (err) {
        next(err);
    }
}

// ── Admin: List All Inquiries with Filter, Search & Stats ──
export async function getAdminContacts(req: Request, res: Response, next: NextFunction) {
    try {
        const currentAdminId = req.user?.sub;
        const status = req.query.status as string;
        const search = req.query.search as string;
        const page = req.query.page ? Number(req.query.page) : 1;
        const limit = req.query.limit ? Number(req.query.limit) : 50;

        const result = await contactService.getAllContactsForAdmin(
            currentAdminId,
            status,
            search,
            page,
            limit
        );

        return sendSuccess(res, result, httpStatus.OK, 'Contact inquiries retrieved.');
    } catch (err) {
        next(err);
    }
}

// ── Admin: Mark Contact Inquiry as Checked by Current Admin ──
export async function markChecked(req: Request, res: Response, next: NextFunction) {
    try {
        const id = getParam(req.params.id);
        const adminUser = {
            id: req.user!.sub,
            name: req.user!.email ? req.user!.email.split('@')[0] : 'Administrator',
            email: req.user!.email || 'admin@citycare.com',
            role: req.user!.role,
        };

        const updated = await contactService.markContactChecked(id, adminUser);
        if (!updated) {
            return sendError(res, httpStatus.NOT_FOUND, 'Contact inquiry not found.');
        }

        return sendSuccess(res, updated, httpStatus.OK, 'Marked as checked by you (#5257e3).');
    } catch (err) {
        next(err);
    }
}

// ── Admin: Update Status (Toggle Unchecked / Checked by Me / Checked by Other) ──
export async function updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const id = getParam(req.params.id);
        const { status } = updateStatusSchema.parse(req.body);
        const adminUser = {
            id: req.user!.sub,
            name: req.user!.email ? req.user!.email.split('@')[0] : 'Administrator',
            email: req.user!.email || 'admin@citycare.com',
            role: req.user!.role,
        };

        const updated = await contactService.updateContactStatus(id, status, adminUser);
        if (!updated) {
            return sendError(res, httpStatus.NOT_FOUND, 'Contact inquiry not found.');
        }

        return sendSuccess(res, updated, httpStatus.OK, `Status updated to ${status}.`);
    } catch (err) {
        next(err);
    }
}

// ── Admin: Send Reply / Record Response ──
export async function replyContact(req: Request, res: Response, next: NextFunction) {
    try {
        const id = getParam(req.params.id);
        const { replyMessage } = replySchema.parse(req.body);
        const adminUser = {
            id: req.user!.sub,
            name: req.user!.email ? req.user!.email.split('@')[0] : 'Administrator',
            email: req.user!.email || 'admin@citycare.com',
            role: req.user!.role,
        };

        const updated = await contactService.replyToContact(id, replyMessage, adminUser);
        if (!updated) {
            return sendError(res, httpStatus.NOT_FOUND, 'Contact inquiry not found.');
        }

        return sendSuccess(res, updated, httpStatus.OK, 'Official reply recorded.');
    } catch (err) {
        next(err);
    }
}

// ── Admin: Delete Contact Inquiry ──
export async function deleteContact(req: Request, res: Response, next: NextFunction) {
    try {
        const id = getParam(req.params.id);
        const adminUser = {
            id: req.user!.sub,
            name: req.user!.email ? req.user!.email.split('@')[0] : 'Administrator',
            email: req.user!.email || 'admin@citycare.com',
            role: req.user!.role,
        };

        const deleted = await contactService.deleteContact(id, adminUser);
        if (!deleted) {
            return sendError(res, httpStatus.NOT_FOUND, 'Contact inquiry not found.');
        }

        return sendSuccess(res, { deleted: true }, httpStatus.OK, 'Inquiry record deleted.');
    } catch (err) {
        next(err);
    }
}
