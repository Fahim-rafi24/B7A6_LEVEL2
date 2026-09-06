import { prisma } from '../prisma/client';

export interface CreateAuditLogParams {
    actorId?: string | null;
    actorName: string;
    actorRole: string;
    action: string;
    targetType: string;
    targetId?: string | null;
    targetTitle?: string | null;
    details?: string | null;
    ipAddress?: string | null;
}

export async function recordAuditLog(params: CreateAuditLogParams) {
    try {
        return await prisma.auditLog.create({
            data: {
                actorId: params.actorId || null,
                actorName: params.actorName,
                actorRole: params.actorRole,
                action: params.action,
                targetType: params.targetType,
                targetId: params.targetId || null,
                targetTitle: params.targetTitle || null,
                details: params.details || null,
                ipAddress: params.ipAddress || null,
            },
        });
    } catch (err) {
        console.error('Failed to record audit log:', (err as Error).message);
        return null;
    }
}
