import { prisma } from '../prisma/client';
import { recordAuditLog } from './audit.service';

export interface CreateFeedbackDTO {
    citizenName?: string;
    citizenEmail?: string;
    citizenId?: string;
    complaintId?: string;
    category?: string;
    rating: number;
    comment: string;
}

export async function createFeedback(data: CreateFeedbackDTO) {
    const feedback = await prisma.feedback.create({
        data: {
            citizenName: data.citizenName || 'Verified Citizen',
            citizenEmail: data.citizenEmail,
            citizenId: data.citizenId,
            complaintId: data.complaintId,
            category: data.category || 'General City Feedback',
            rating: Math.max(1, Math.min(5, Number(data.rating) || 5)),
            comment: data.comment,
            status: 'PENDING',
        },
        include: {
            citizen: {
                select: { id: true, name: true, avatarUrl: true },
            },
            complaint: {
                select: { id: true, trackingNumber: true, title: true, category: true },
            },
        },
    });

    return feedback;
}

export async function getPublicApprovedFeedbacks(category?: string, rating?: number) {
    const where: any = {
        status: 'APPROVED',
    };

    if (category && category !== 'ALL') {
        where.category = { contains: category, mode: 'insensitive' };
    }

    if (rating && !isNaN(rating)) {
        where.rating = Number(rating);
    }

    const [items, totalApproved] = await Promise.all([
        prisma.feedback.findMany({
            where,
            orderBy: [
                { isFeatured: 'desc' },
                { createdAt: 'desc' },
            ],
            include: {
                citizen: {
                    select: { id: true, name: true, avatarUrl: true },
                },
                complaint: {
                    select: { id: true, trackingNumber: true, title: true, category: true },
                },
            },
        }),
        prisma.feedback.count({ where: { status: 'APPROVED' } }),
    ]);

    // Compute stats
    const allApproved = await prisma.feedback.findMany({
        where: { status: 'APPROVED' },
        select: { rating: true },
    });

    const totalRatings = allApproved.length;
    const avgRating =
        totalRatings > 0
            ? Number(
                  (
                      allApproved.reduce((sum, f) => sum + f.rating, 0) /
                      totalRatings
                  ).toFixed(1)
              )
            : 5.0;

    const positiveCount = allApproved.filter((f) => f.rating >= 4).length;
    const positivePercentage =
        totalRatings > 0 ? Math.round((positiveCount / totalRatings) * 100) : 100;

    return {
        items,
        total: items.length,
        stats: {
            totalApproved,
            avgRating,
            positivePercentage,
        },
    };
}

export async function getAllFeedbacksForAdmin(
    status?: string,
    search?: string,
    page = 1,
    limit = 50
) {
    const where: any = {};

    if (status && status !== 'ALL') {
        where.status = status.toUpperCase();
    }

    if (search && search.trim() !== '') {
        const query = search.trim();
        where.OR = [
            { citizenName: { contains: query, mode: 'insensitive' } },
            { citizenEmail: { contains: query, mode: 'insensitive' } },
            { comment: { contains: query, mode: 'insensitive' } },
            { category: { contains: query, mode: 'insensitive' } },
            { complaint: { trackingNumber: { contains: query, mode: 'insensitive' } } },
        ];
    }

    const skip = (page - 1) * limit;

    const [items, total, pendingCount, approvedCount, rejectedCount] = await Promise.all([
        prisma.feedback.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                citizen: {
                    select: { id: true, name: true, email: true, avatarUrl: true },
                },
                complaint: {
                    select: { id: true, trackingNumber: true, title: true, category: true },
                },
            },
        }),
        prisma.feedback.count({ where }),
        prisma.feedback.count({ where: { status: 'PENDING' } }),
        prisma.feedback.count({ where: { status: 'APPROVED' } }),
        prisma.feedback.count({ where: { status: 'REJECTED' } }),
    ]);

    const totalAll = pendingCount + approvedCount + rejectedCount;

    return {
        items,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1,
            counts: {
                totalAll,
                pendingCount,
                approvedCount,
                rejectedCount,
            },
        },
    };
}

export async function updateFeedbackStatus(
    id: string,
    status: 'APPROVED' | 'REJECTED' | 'PENDING',
    adminUser: { id: string; name: string; role: string }
) {
    const existing = await prisma.feedback.findUnique({ where: { id } });
    if (!existing) return null;

    const updated = await prisma.feedback.update({
        where: { id },
        data: {
            status,
            moderatedBy: adminUser.name || 'Admin',
            moderatedAt: new Date(),
        },
        include: {
            citizen: {
                select: { id: true, name: true, email: true, avatarUrl: true },
            },
            complaint: {
                select: { id: true, trackingNumber: true, title: true, category: true },
            },
        },
    });

    await recordAuditLog({
        actorId: adminUser.id,
        actorName: adminUser.name,
        actorRole: adminUser.role,
        action: `FEEDBACK_${status}`,
        targetType: 'Feedback',
        targetId: id,
        targetTitle: existing.citizenName || 'Citizen Feedback',
        details: `Feedback status changed from ${existing.status} to ${status}.`,
    });

    return updated;
}

export async function deleteFeedback(
    id: string,
    adminUser: { id: string; name: string; role: string }
) {
    const existing = await prisma.feedback.findUnique({ where: { id } });
    if (!existing) return null;

    // Archive in feedbacks_del
    await prisma.feedbackDel.create({
        data: {
            originalFeedbackId: existing.id,
            complaintId: existing.complaintId,
            citizenId: existing.citizenId,
            rating: existing.rating,
            comment: existing.comment,
            dataSnapshot: existing as any,
            deletedBy: adminUser.name || adminUser.id,
            deletionReason: 'Administrative cleanup',
        },
    });

    await prisma.feedback.delete({ where: { id } });

    await recordAuditLog({
        actorId: adminUser.id,
        actorName: adminUser.name,
        actorRole: adminUser.role,
        action: 'FEEDBACK_DELETED',
        targetType: 'Feedback',
        targetId: id,
        targetTitle: existing.citizenName || 'Citizen Feedback',
        details: `Feedback record soft-deleted and archived.`,
    });

    return true;
}
