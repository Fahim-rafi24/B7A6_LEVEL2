import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as paymentService from '../services/payment.service';
import { sendSuccess, sendError } from '../utils/apiResponse.util';
import { httpStatus } from '../config/http_status';
import { stripe } from '../config/stripe';
import { env } from '../config/env';
import { getParam } from '../utils/param.util';

const initiatePaymentSchema = z.object({
    complaintId: z.string().min(1, 'complaintId is required'),
});

const softDeletePaymentSchema = z.object({
    reason: z.string().optional(),
});

// ── Initiate Stripe Payment (Premium / Specialized Services) ──
export async function initiatePayment(req: Request, res: Response, next: NextFunction) {
    try {
        const { complaintId } = initiatePaymentSchema.parse(req.body);
        const user = req.user!;

        const result = await paymentService.initiateServicePayment(complaintId, {
            id: user.sub,
            name: user.email || 'Citizen',
            email: user.email || 'citizen@citycare.com',
            role: user.role,
        });

        return sendSuccess(res, result, httpStatus.CREATED, 'Stripe payment session created.');
    } catch (err) {
        next(err);
    }
}

// ── Verify Payment Session Callback ──
export async function verifyPayment(req: Request, res: Response, next: NextFunction) {
    try {
        const sessionId = req.query.session_id as string;
        if (!sessionId) {
            return sendError(res, httpStatus.BAD_REQUEST, 'session_id query parameter is required.');
        }

        const payment = await paymentService.handlePaymentSuccess(sessionId);
        if (!payment) {
            return sendError(res, httpStatus.NOT_FOUND, 'Payment record with given session was not found.');
        }

        return sendSuccess(res, payment, httpStatus.OK, 'Payment verified successfully.');
    } catch (err) {
        next(err);
    }
}

// ── Stripe Webhook Handler ──
export async function handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
        const sig = req.headers['stripe-signature'];
        let event: any = req.body;

        if (env.STRIPE_WEBHOOK_SECRET && sig) {
            try {
                event = stripe.webhooks.constructEvent(
                    req.body,
                    sig,
                    env.STRIPE_WEBHOOK_SECRET
                );
            } catch (err) {
                return sendError(res, httpStatus.BAD_REQUEST, `Webhook Error: ${(err as Error).message}`);
            }
        }

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            await paymentService.handlePaymentSuccess(session.id, session.payment_intent as string);
        }

        return res.status(200).json({ received: true });
    } catch (err) {
        next(err);
    }
}

// ── Get Citizen's Payment History ──
export async function getMyPayments(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!;
        const page = req.query.page ? Number(req.query.page) : 1;
        const limit = req.query.limit ? Number(req.query.limit) : 10;

        const result = await paymentService.getCitizenPayments(user.sub, page, limit);
        return sendSuccess(res, result, httpStatus.OK, 'Payment history retrieved.');
    } catch (err) {
        next(err);
    }
}

// ── Soft-Delete Payment to payments_del (Admin) ──
export async function softDeletePayment(req: Request, res: Response, next: NextFunction) {
    try {
        const id = getParam(req.params.id);
        const { reason } = softDeletePaymentSchema.parse(req.body || {});
        const user = req.user!;

        const archived = await paymentService.softDeletePayment(
            id,
            { id: user.sub, name: user.email || 'Admin', role: user.role },
            reason
        );

        if (!archived) {
            return sendError(res, httpStatus.NOT_FOUND, 'Payment record not found.');
        }

        return sendSuccess(res, archived, httpStatus.OK, 'Payment soft-deleted and archived in payments_del.');
    } catch (err) {
        next(err);
    }
}
