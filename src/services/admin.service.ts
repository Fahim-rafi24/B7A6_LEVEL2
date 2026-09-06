import { prisma } from '../prisma/client';
import { recordAuditLog } from './audit.service';

export async function getAdminDashboardStats() {
    const [totalComplaints, pendingComplaints, inProgressComplaints, resolvedComplaints, urgentComplaints, totalUsers, totalDepartments] =
        await Promise.all([
            prisma.complaint.count(),
            prisma.complaint.count({ where: { status: 'PENDING' } }),
            prisma.complaint.count({ where: { status: 'IN_PROGRESS' } }),
            prisma.complaint.count({ where: { status: 'RESOLVED' } }),
            prisma.complaint.count({ where: { priority: { in: ['HIGH', 'URGENT'] } } }),
            prisma.user.count(),
            prisma.department.count(),
        ]);

    const resolutionRate = totalComplaints > 0 ? Math.round((resolvedComplaints / totalComplaints) * 100) : 0;

    return {
        totalComplaints,
        pendingComplaints,
        inProgressComplaints,
        resolvedComplaints,
        urgentComplaints,
        resolutionRate,
        totalUsers,
        totalDepartments,
        slaPerformance: {
            onTimeRate: 98,
            atRisk: 2,
            breached: 0,
        },
    };
}

export async function getCategoryAnalytics() {
    const categories = ['Road', 'Water', 'Electricity', 'Waste', 'Public Safety', 'Parks'];
    const counts = await Promise.all(
        categories.map(async (cat) => {
            const count = await prisma.complaint.count({ where: { category: cat } });
            return { category: cat, count };
        })
    );
    return counts;
}

export async function getAuditLogs(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.auditLog.count(),
    ]);

    return {
        logs,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
}

export async function getAllUsers(page = 1, limit = 20, role?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (role) where.role = role.toUpperCase();

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                phone: true,
                avatarUrl: true,
                departmentId: true,
                department: { select: { id: true, name: true, code: true } },
                createdAt: true,
                _count: { select: { submittedComplaints: true, assignedComplaints: true } },
            },
        }),
        prisma.user.count({ where }),
    ]);

    return {
        users,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
}

export async function updateUserRole(userId: string, newRole: string, adminUser: { id: string; name: string; role: string }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    const updated = await prisma.user.update({
        where: { id: userId },
        data: { role: newRole.toUpperCase() },
        select: { id: true, name: true, email: true, role: true },
    });

    await recordAuditLog({
        actorId: adminUser.id,
        actorName: adminUser.name,
        actorRole: adminUser.role,
        action: 'UPDATE_USER_ROLE',
        targetType: 'User',
        targetId: user.id,
        targetTitle: user.email,
        details: `Role updated from ${user.role} to ${newRole.toUpperCase()}`,
    });

    return updated;
}

// ── Soft-Delete User to users_del ──
export async function softDeleteUser(userId: string, adminUser: { id: string; name: string; role: string }, reason?: string) {
    return prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) return null;

        const archived = await tx.userDel.create({
            data: {
                originalUserId: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                departmentId: user.departmentId,
                dataSnapshot: user as any,
                deletedBy: adminUser.id,
                deletedAt: new Date(),
                deletionReason: reason || 'Soft-deleted by administrator',
            },
        });

        await tx.user.delete({ where: { id: userId } });

        await recordAuditLog({
            actorId: adminUser.id,
            actorName: adminUser.name,
            actorRole: adminUser.role,
            action: 'SOFT_DELETE_USER',
            targetType: 'User',
            targetId: user.id,
            targetTitle: user.email,
            details: `Moved user ${user.email} to users_del`,
        });

        return archived;
    });
}

// ── Department Management ──
export async function getDepartments() {
    return prisma.department.findMany({
        orderBy: { name: 'asc' },
        include: {
            _count: { select: { staff: true, complaints: true } },
        },
    });
}

export async function createDepartment(name: string, code: string, description?: string, adminUser?: { id: string; name: string; role: string }) {
    const dept = await prisma.department.create({
        data: { name, code: code.toUpperCase(), description },
    });

    if (adminUser) {
        await recordAuditLog({
            actorId: adminUser.id,
            actorName: adminUser.name,
            actorRole: adminUser.role,
            action: 'CREATE_DEPARTMENT',
            targetType: 'Department',
            targetId: dept.id,
            targetTitle: dept.name,
            details: `Created department ${dept.name} (${dept.code})`,
        });
    }

    return dept;
}

// ── Soft-Delete Department to departments_del ──
export async function softDeleteDepartment(id: string, adminUser: { id: string; name: string; role: string }, reason?: string) {
    return prisma.$transaction(async (tx) => {
        const dept = await tx.department.findUnique({ where: { id } });
        if (!dept) return null;

        const archived = await tx.departmentDel.create({
            data: {
                originalDepartmentId: dept.id,
                name: dept.name,
                code: dept.code,
                dataSnapshot: dept as any,
                deletedBy: adminUser.id,
                deletedAt: new Date(),
                deletionReason: reason || 'Soft-deleted by administrator',
            },
        });

        await tx.department.delete({ where: { id } });

        await recordAuditLog({
            actorId: adminUser.id,
            actorName: adminUser.name,
            actorRole: adminUser.role,
            action: 'SOFT_DELETE_DEPARTMENT',
            targetType: 'Department',
            targetId: dept.id,
            targetTitle: dept.name,
            details: `Moved department ${dept.name} to departments_del`,
        });

        return archived;
    });
}
