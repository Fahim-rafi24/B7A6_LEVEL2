import { prisma } from '../prisma/client';
import { recordAuditLog } from './audit.service';

export interface CreateContactDTO {
    name: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
}

export async function createContactInquiry(data: CreateContactDTO) {
    const contact = await prisma.contact.create({
        data: {
            name: data.name,
            email: data.email,
            phone: data.phone || null,
            subject: data.subject,
            message: data.message,
            status: 'UNCHECKED',
        },
    });

    return contact;
}

export async function getAllContactsForAdmin(
    currentAdminId?: string,
    statusFilter?: string,
    search?: string,
    page = 1,
    limit = 50
) {
    const where: any = {};

    if (search && search.trim() !== '') {
        const query = search.trim();
        where.OR = [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { subject: { contains: query, mode: 'insensitive' } },
            { message: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
        ];
    }

    if (statusFilter && statusFilter !== 'ALL') {
        if (statusFilter === 'UNCHECKED') {
            where.OR = [
                { status: 'UNCHECKED' },
                { checkedByAdminId: null },
            ];
        } else if (statusFilter === 'CHECKED_BY_ME' && currentAdminId) {
            where.checkedByAdminId = currentAdminId;
        } else if (statusFilter === 'CHECKED_BY_OTHER') {
            if (currentAdminId) {
                where.AND = [
                    { checkedByAdminId: { not: null } },
                    { checkedByAdminId: { not: currentAdminId } },
                ];
            } else {
                where.checkedByAdminId = { not: null };
            }
        } else if (statusFilter === 'REPLIED') {
            where.isReplied = true;
        }
    }

    const skip = (page - 1) * limit;

    const [allRecords, total] = await Promise.all([
        prisma.contact.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.contact.count({ where }),
    ]);

    // Count statistics across whole table
    const [totalAll, uncheckedCount, repliedCount, checkedRecords] = await Promise.all([
        prisma.contact.count(),
        prisma.contact.count({
            where: {
                OR: [{ status: 'UNCHECKED' }, { checkedByAdminId: null }],
            },
        }),
        prisma.contact.count({ where: { isReplied: true } }),
        prisma.contact.findMany({
            where: { checkedByAdminId: { not: null } },
            select: { id: true, checkedByAdminId: true },
        }),
    ]);

    let checkedByMeCount = 0;
    let checkedByOtherCount = 0;

    checkedRecords.forEach((item) => {
        if (currentAdminId && item.checkedByAdminId === currentAdminId) {
            checkedByMeCount++;
        } else {
            checkedByOtherCount++;
        }
    });

    // Map item status dynamically based on requesting admin
    const items = allRecords.map((item) => {
        let computedStatus: 'UNCHECKED' | 'CHECKED_BY_ME' | 'CHECKED_BY_OTHER' = 'UNCHECKED';
        if (item.checkedByAdminId) {
            if (currentAdminId && item.checkedByAdminId === currentAdminId) {
                computedStatus = 'CHECKED_BY_ME';
            } else {
                computedStatus = 'CHECKED_BY_OTHER';
            }
        }
        return {
            ...item,
            status: computedStatus,
        };
    });

    return {
        items,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1,
            counts: {
                totalAll,
                uncheckedCount,
                checkedByMeCount,
                checkedByOtherCount,
                repliedCount,
            },
        },
    };
}

export async function markContactChecked(
    id: string,
    adminUser: { id: string; name: string; email: string; role: string }
) {
    const existing = await prisma.contact.findUnique({ where: { id } });
    if (!existing) return null;

    // If already checked by this admin, return as-is
    if (existing.checkedByAdminId === adminUser.id) {
        return {
            ...existing,
            status: 'CHECKED_BY_ME' as const,
        };
    }

    const updated = await prisma.contact.update({
        where: { id },
        data: {
            status: 'CHECKED',
            checkedByAdminId: adminUser.id,
            checkedByAdminName: adminUser.name || adminUser.email,
            checkedByAdminEmail: adminUser.email,
            checkedAt: new Date(),
        },
    });

    await recordAuditLog({
        actorId: adminUser.id,
        actorName: adminUser.name || adminUser.email,
        actorRole: adminUser.role,
        action: 'CONTACT_CHECKED',
        targetType: 'ContactInquiry',
        targetId: id,
        targetTitle: existing.subject,
        details: `Inquiry opened and checked by admin ${adminUser.name || adminUser.email}`,
    });

    return {
        ...updated,
        status: 'CHECKED_BY_ME' as const,
    };
}

export async function updateContactStatus(
    id: string,
    targetStatus: 'UNCHECKED' | 'CHECKED_BY_ME' | 'CHECKED_BY_OTHER',
    adminUser: { id: string; name: string; email: string; role: string }
) {
    const existing = await prisma.contact.findUnique({ where: { id } });
    if (!existing) return null;

    let updateData: any = {};

    if (targetStatus === 'UNCHECKED') {
        updateData = {
            status: 'UNCHECKED',
            checkedByAdminId: null,
            checkedByAdminName: null,
            checkedByAdminEmail: null,
            checkedAt: null,
        };
    } else if (targetStatus === 'CHECKED_BY_ME') {
        updateData = {
            status: 'CHECKED',
            checkedByAdminId: adminUser.id,
            checkedByAdminName: adminUser.name || adminUser.email,
            checkedByAdminEmail: adminUser.email,
            checkedAt: new Date(),
        };
    } else if (targetStatus === 'CHECKED_BY_OTHER') {
        updateData = {
            status: 'CHECKED',
            checkedByAdminId: 'other-admin-id',
            checkedByAdminName: 'Sarah Davis (Admin)',
            checkedByAdminEmail: 'sarah.davis@citycare.com',
            checkedAt: new Date(),
        };
    }

    const updated = await prisma.contact.update({
        where: { id },
        data: updateData,
    });

    await recordAuditLog({
        actorId: adminUser.id,
        actorName: adminUser.name || adminUser.email,
        actorRole: adminUser.role,
        action: `CONTACT_STATUS_${targetStatus}`,
        targetType: 'ContactInquiry',
        targetId: id,
        targetTitle: existing.subject,
        details: `Contact inquiry status manually set to ${targetStatus}`,
    });

    return {
        ...updated,
        status: targetStatus,
    };
}

export async function replyToContact(
    id: string,
    replyMessage: string,
    adminUser: { id: string; name: string; email: string; role: string }
) {
    const existing = await prisma.contact.findUnique({ where: { id } });
    if (!existing) return null;

    const updated = await prisma.contact.update({
        where: { id },
        data: {
            isReplied: true,
            replyMessage,
            repliedAt: new Date(),
        },
    });

    await recordAuditLog({
        actorId: adminUser.id,
        actorName: adminUser.name || adminUser.email,
        actorRole: adminUser.role,
        action: 'CONTACT_REPLIED',
        targetType: 'ContactInquiry',
        targetId: id,
        targetTitle: existing.subject,
        details: `Official response recorded for ${existing.email}`,
    });

    return updated;
}

export async function deleteContact(
    id: string,
    adminUser: { id: string; name: string; email: string; role: string }
) {
    const existing = await prisma.contact.findUnique({ where: { id } });
    if (!existing) return null;

    await prisma.contactDel.create({
        data: {
            originalContactId: existing.id,
            name: existing.name,
            email: existing.email,
            subject: existing.subject,
            message: existing.message,
            dataSnapshot: existing as any,
            deletedBy: adminUser.name || adminUser.id,
            deletionReason: 'Administrative cleanup',
        },
    });

    await prisma.contact.delete({ where: { id } });

    await recordAuditLog({
        actorId: adminUser.id,
        actorName: adminUser.name || adminUser.email,
        actorRole: adminUser.role,
        action: 'CONTACT_DELETED',
        targetType: 'ContactInquiry',
        targetId: id,
        targetTitle: existing.subject,
        details: `Inquiry deleted and archived.`,
    });

    return true;
}
