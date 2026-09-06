import { prisma } from '../prisma/client';
import { recordAuditLog } from './audit.service';
import { env } from '../config/env';

export interface CreateComplaintInput {
    title: string;
    description: string;
    category: string;
    priority?: string;
    location: string;
    latitude?: number;
    longitude?: number;
    imageUrl?: string;
    citizenId: string;
    citizenName: string;
    citizenRole: string;
    isPremiumService?: boolean;
    serviceFee?: number;
    departmentId?: string;
}

export interface ComplaintFilterParams {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    status?: string;
    priority?: string;
    departmentId?: string;
    citizenId?: string;
    assignedStaffId?: string;
    isPremiumService?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

function generateTrackingNumber(): string {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    return `CC-${datePart}-${randomPart}`;
}

export async function createComplaint(input: CreateComplaintInput) {
    const trackingNumber = generateTrackingNumber();
    const isPremium = Boolean(input.isPremiumService);
    const fee = isPremium ? (input.serviceFee || env.DEFAULT_PREMIUM_FEE) : 0.00;
    const paymentStatus = isPremium ? 'UNPAID' : 'NOT_APPLICABLE';

    const complaint = await prisma.$transaction(async (tx) => {
        const created = await tx.complaint.create({
            data: {
                trackingNumber,
                title: input.title,
                description: input.description,
                category: input.category,
                priority: (input.priority || 'MEDIUM').toUpperCase(),
                status: 'PENDING',
                location: input.location,
                latitude: input.latitude || null,
                longitude: input.longitude || null,
                imageUrl: input.imageUrl || null,
                citizenId: input.citizenId,
                departmentId: input.departmentId || null,
                isPremiumService: isPremium,
                serviceFee: fee,
                paymentStatus,
            },
            include: {
                citizen: { select: { id: true, name: true, email: true } },
                department: true,
            },
        });

        await tx.complaintTimeline.create({
            data: {
                complaintId: created.id,
                actorId: input.citizenId,
                status: 'PENDING',
                content: 'Complaint submitted',
                desc: isPremium
                    ? 'Premium service request submitted. Pending payment and review.'
                    : 'Issue reported by citizen. Awaiting department assignment.',
            },
        });

        return created;
    });

    await recordAuditLog({
        actorId: input.citizenId,
        actorName: input.citizenName,
        actorRole: input.citizenRole,
        action: 'SUBMIT_COMPLAINT',
        targetType: 'Complaint',
        targetId: complaint.id,
        targetTitle: complaint.title,
        details: `Created complaint #${complaint.trackingNumber} in category ${complaint.category}`,
    });

    return complaint;
}

export async function getComplaints(params: ComplaintFilterParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.search) {
        where.OR = [
            { title: { contains: params.search, mode: 'insensitive' } },
            { description: { contains: params.search, mode: 'insensitive' } },
            { location: { contains: params.search, mode: 'insensitive' } },
            { trackingNumber: { contains: params.search, mode: 'insensitive' } },
        ];
    }

    if (params.category) where.category = params.category;
    if (params.status) where.status = params.status.toUpperCase();
    if (params.priority) where.priority = params.priority.toUpperCase();
    if (params.departmentId) where.departmentId = params.departmentId;
    if (params.citizenId) where.citizenId = params.citizenId;
    if (params.assignedStaffId) where.assignedStaffId = params.assignedStaffId;
    if (typeof params.isPremiumService === 'boolean') where.isPremiumService = params.isPremiumService;

    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc';

    const [complaints, total] = await Promise.all([
        prisma.complaint.findMany({
            where,
            skip,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
            include: {
                citizen: { select: { id: true, name: true, email: true } },
                department: { select: { id: true, name: true, code: true } },
                assignedStaff: { select: { id: true, name: true, email: true } },
                _count: { select: { timelines: true } },
            },
        }),
        prisma.complaint.count({ where }),
    ]);

    return {
        complaints,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1,
        },
    };
}

export async function getComplaintById(id: string) {
    return prisma.complaint.findFirst({
        where: {
            OR: [{ id }, { trackingNumber: id }],
        },
        include: {
            citizen: { select: { id: true, name: true, email: true, phone: true } },
            department: true,
            assignedStaff: { select: { id: true, name: true, email: true } },
            timelines: { orderBy: { createdAt: 'asc' } },
            feedback: true,
            payments: { orderBy: { createdAt: 'desc' } },
        },
    });
}

export async function updateComplaint(id: string, data: Partial<CreateComplaintInput>, user: { id: string; name: string; role: string }) {
    const existing = await prisma.complaint.findUnique({ where: { id } });
    if (!existing) return null;

    const updated = await prisma.complaint.update({
        where: { id },
        data: {
            title: data.title !== undefined ? data.title : existing.title,
            description: data.description !== undefined ? data.description : existing.description,
            category: data.category !== undefined ? data.category : existing.category,
            priority: data.priority !== undefined ? data.priority.toUpperCase() : existing.priority,
            location: data.location !== undefined ? data.location : existing.location,
            imageUrl: data.imageUrl !== undefined ? data.imageUrl : existing.imageUrl,
        },
    });

    await recordAuditLog({
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'UPDATE_COMPLAINT',
        targetType: 'Complaint',
        targetId: updated.id,
        targetTitle: updated.title,
        details: 'Complaint content updated',
    });

    return updated;
}

// ── Soft-Delete into complaints_info_del ──
export async function softDeleteComplaint(id: string, user: { id: string; name: string; role: string }, reason?: string) {
    return prisma.$transaction(async (tx) => {
        const complaint = await tx.complaint.findUnique({
            where: { id },
            include: {
                timelines: true,
                feedback: true,
                payments: true,
            },
        });

        if (!complaint) return null;

        // Archive into complaints_info_del
        const archived = await tx.complaintDel.create({
            data: {
                originalComplaintId: complaint.id,
                trackingNumber: complaint.trackingNumber,
                title: complaint.title,
                description: complaint.description,
                category: complaint.category,
                priority: complaint.priority,
                status: complaint.status,
                location: complaint.location,
                citizenId: complaint.citizenId,
                departmentId: complaint.departmentId,
                assignedStaffId: complaint.assignedStaffId,
                imageUrl: complaint.imageUrl,
                isPremiumService: complaint.isPremiumService,
                serviceFee: complaint.serviceFee,
                paymentStatus: complaint.paymentStatus,
                dataSnapshot: complaint as any,
                deletedBy: user.id,
                deletedAt: new Date(),
                deletionReason: reason || 'Soft-deleted by user/admin',
            },
        });

        // Delete from main active table
        await tx.complaint.delete({ where: { id } });

        await recordAuditLog({
            actorId: user.id,
            actorName: user.name,
            actorRole: user.role,
            action: 'SOFT_DELETE_COMPLAINT',
            targetType: 'Complaint',
            targetId: complaint.id,
            targetTitle: complaint.title,
            details: `Moved #${complaint.trackingNumber} to complaints_info_del. Reason: ${reason || 'Not specified'}`,
        });

        return archived;
    });
}

// ── Restore from complaints_info_del back to complaints_info ──
export async function restoreComplaint(archivedId: string, user: { id: string; name: string; role: string }) {
    return prisma.$transaction(async (tx) => {
        const archived = await tx.complaintDel.findFirst({
            where: {
                OR: [{ id: archivedId }, { originalComplaintId: archivedId }],
            },
        });

        if (!archived) return null;

        // Recreate in complaints_info
        const restored = await tx.complaint.create({
            data: {
                id: archived.originalComplaintId,
                trackingNumber: archived.trackingNumber,
                title: archived.title,
                description: archived.description,
                category: archived.category,
                priority: archived.priority,
                status: archived.status,
                location: archived.location,
                citizenId: archived.citizenId,
                departmentId: archived.departmentId,
                assignedStaffId: archived.assignedStaffId,
                imageUrl: archived.imageUrl,
                isPremiumService: archived.isPremiumService,
                serviceFee: archived.serviceFee,
                paymentStatus: archived.paymentStatus,
            },
        });

        // Remove from complaints_info_del
        await tx.complaintDel.delete({ where: { id: archived.id } });

        await tx.complaintTimeline.create({
            data: {
                complaintId: restored.id,
                actorId: user.id,
                status: restored.status,
                content: 'Complaint restored',
                desc: `Restored from archive by ${user.name} (${user.role})`,
            },
        });

        await recordAuditLog({
            actorId: user.id,
            actorName: user.name,
            actorRole: user.role,
            action: 'RESTORE_COMPLAINT',
            targetType: 'Complaint',
            targetId: restored.id,
            targetTitle: restored.title,
            details: `Restored #${restored.trackingNumber} from complaints_info_del to complaints_info`,
        });

        return restored;
    });
}

// ── Get Archived Complaints ──
export async function getArchivedComplaints(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [archived, total] = await Promise.all([
        prisma.complaintDel.findMany({
            skip,
            take: limit,
            orderBy: { deletedAt: 'desc' },
        }),
        prisma.complaintDel.count(),
    ]);

    return {
        archived,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
}

// ── Assign Department and Staff ──
export async function assignComplaint(
    id: string,
    departmentId: string,
    assignedStaffId: string | null,
    user: { id: string; name: string; role: string }
) {
    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) return null;

    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    const deptName = department ? department.name : 'Selected Department';

    const updated = await prisma.$transaction(async (tx) => {
        const res = await tx.complaint.update({
            where: { id },
            data: {
                departmentId,
                assignedStaffId: assignedStaffId || null,
                status: complaint.status === 'PENDING' ? 'ASSIGNED' : complaint.status,
            },
            include: {
                department: true,
                assignedStaff: { select: { id: true, name: true, email: true } },
            },
        });

        await tx.complaintTimeline.create({
            data: {
                complaintId: id,
                actorId: user.id,
                status: 'ASSIGNED',
                content: `Assigned to ${deptName}`,
                desc: assignedStaffId ? `Assigned to staff member for inspection.` : `Routed to ${deptName} queue.`,
            },
        });

        return res;
    });

    await recordAuditLog({
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'ASSIGN_COMPLAINT',
        targetType: 'Complaint',
        targetId: id,
        targetTitle: complaint.title,
        details: `Assigned to department: ${deptName}`,
    });

    return updated;
}

// ── Update Status & Timeline ──
export async function updateComplaintStatus(
    id: string,
    status: string,
    content: string,
    desc: string | undefined,
    user: { id: string; name: string; role: string }
) {
    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) return null;

    const normalizedStatus = status.toUpperCase();
    const isResolved = normalizedStatus === 'RESOLVED';

    const updated = await prisma.$transaction(async (tx) => {
        const res = await tx.complaint.update({
            where: { id },
            data: {
                status: normalizedStatus,
                resolvedAt: isResolved ? new Date() : complaint.resolvedAt,
            },
            include: {
                department: true,
                assignedStaff: { select: { id: true, name: true, email: true } },
            },
        });

        await tx.complaintTimeline.create({
            data: {
                complaintId: id,
                actorId: user.id,
                status: normalizedStatus,
                content: content || `Status changed to ${normalizedStatus}`,
                desc: desc || `Updated by ${user.name} (${user.role})`,
            },
        });

        return res;
    });

    await recordAuditLog({
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'UPDATE_STATUS',
        targetType: 'Complaint',
        targetId: id,
        targetTitle: complaint.title,
        details: `Status updated from ${complaint.status} to ${normalizedStatus}`,
    });

    return updated;
}

// ── Add Feedback ──
export async function addComplaintFeedback(
    complaintId: string,
    citizenId: string,
    citizenName: string,
    rating: number,
    comment?: string
) {
    const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
    if (!complaint) return null;

    const feedback = await prisma.feedback.upsert({
        where: { complaintId },
        update: { rating, comment },
        create: {
            complaintId,
            citizenId,
            rating,
            comment,
        },
    });

    await recordAuditLog({
        actorId: citizenId,
        actorName: citizenName,
        actorRole: 'CITIZEN',
        action: 'SUBMIT_FEEDBACK',
        targetType: 'Feedback',
        targetId: feedback.id,
        targetTitle: `Review for #${complaint.trackingNumber}`,
        details: `Rating: ${rating}/5. Comment: ${comment || 'None'}`,
    });

    return feedback;
}
