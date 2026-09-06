import { prisma } from '../prisma/client';
import { createStripeCheckoutSession } from '../config/stripe';
import { recordAuditLog } from './audit.service';

export async function initiateServicePayment(complaintId: string, citizen: { id: string; name: string; email: string; role: string }) {
    const complaint = await prisma.complaint.findUnique({
        where: { id: complaintId },
        include: { citizen: true },
    });

    if (!complaint) {
        throw new Error('Complaint not found.');
    }

    // Ensure payments are only processed for Premium / Specialized Services
    if (!complaint.isPremiumService) {
        throw new Error('This complaint is a standard public service request which is free of charge. Payments are only applicable for Premium / Specialized Services.');
    }

    if (complaint.paymentStatus === 'PAID') {
        throw new Error('This specialized service request has already been paid for.');
    }

    const fee = Number(complaint.serviceFee) || 25.00;

    // Create checkout session
    const { sessionId, url } = await createStripeCheckoutSession({
        complaintId: complaint.id,
        trackingNumber: complaint.trackingNumber,
        title: complaint.title,
        amount: fee,
        currency: 'usd',
        citizenEmail: citizen.email,
    });

    // Record or update payment record
    const payment = await prisma.payment.create({
        data: {
            complaintId: complaint.id,
            userId: citizen.id,
            amount: fee,
            currency: 'USD',
            provider: 'STRIPE',
            sessionId,
            status: 'PENDING',
        },
    });

    await recordAuditLog({
        actorId: citizen.id,
        actorName: citizen.name,
        actorRole: citizen.role,
        action: 'INITIATE_PAYMENT',
        targetType: 'Payment',
        targetId: payment.id,
        targetTitle: `Stripe Checkout for #${complaint.trackingNumber}`,
        details: `Amount: $${fee}. Session ID: ${sessionId}`,
    });

    return {
        paymentId: payment.id,
        sessionId,
        checkoutUrl: url,
        amount: fee,
        currency: 'USD',
        status: 'PENDING',
    };
}

export async function handlePaymentSuccess(sessionId: string, transactionId?: string) {
    return prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findFirst({
            where: { sessionId },
            include: { complaint: true, user: true },
        });

        if (!payment) return null;

        if (payment.status === 'COMPLETED') return payment;

        const updatedPayment = await tx.payment.update({
            where: { id: payment.id },
            data: {
                status: 'COMPLETED',
                transactionId: transactionId || `txn_${Date.now()}`,
            },
        });

        await tx.complaint.update({
            where: { id: payment.complaintId },
            data: {
                paymentStatus: 'PAID',
            },
        });

        await tx.complaintTimeline.create({
            data: {
                complaintId: payment.complaintId,
                actorId: payment.userId,
                status: payment.complaint.status,
                content: 'Payment Confirmed',
                desc: `Service fee of $${payment.amount} confirmed via Stripe. Expedited processing initiated.`,
            },
        });

        await recordAuditLog({
            actorId: payment.userId,
            actorName: payment.user.name,
            actorRole: payment.user.role,
            action: 'PAYMENT_SUCCESS',
            targetType: 'Payment',
            targetId: payment.id,
            targetTitle: `Payment for #${payment.complaint.trackingNumber}`,
            details: `Amount: $${payment.amount} completed via Stripe.`,
        });

        return updatedPayment;
    });
}

export async function getCitizenPayments(citizenId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
        prisma.payment.findMany({
            where: { userId: citizenId },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                complaint: {
                    select: { id: true, trackingNumber: true, title: true, status: true },
                },
            },
        }),
        prisma.payment.count({ where: { userId: citizenId } }),
    ]);

    return {
        payments,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
}

// ── Soft-Delete into payments_del ──
export async function softDeletePayment(id: string, user: { id: string; name: string; role: string }, reason?: string) {
    return prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({ where: { id } });
        if (!payment) return null;

        const archived = await tx.paymentDel.create({
            data: {
                originalPaymentId: payment.id,
                complaintId: payment.complaintId,
                userId: payment.userId,
                amount: payment.amount,
                currency: payment.currency,
                transactionId: payment.transactionId,
                status: payment.status,
                dataSnapshot: payment as any,
                deletedBy: user.id,
                deletedAt: new Date(),
                deletionReason: reason || 'Soft-deleted by admin',
            },
        });

        await tx.payment.delete({ where: { id } });

        await recordAuditLog({
            actorId: user.id,
            actorName: user.name,
            actorRole: user.role,
            action: 'SOFT_DELETE_PAYMENT',
            targetType: 'Payment',
            targetId: payment.id,
            details: `Archived payment ${payment.id} to payments_del`,
        });

        return archived;
    });
}
