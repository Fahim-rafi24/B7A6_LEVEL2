import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma/client';
import { env } from '../config/env';
import { hashPassword } from '../utils/hash.util';

export async function createUser(name: string, email: string, password: string, role = 'CITIZEN', phone?: string, departmentId?: string) {
    const hashed = await hashPassword(password);
    return prisma.user.create({
        data: {
            name,
            email,
            password: hashed,
            role: role.toUpperCase(),
            phone: phone || null,
            departmentId: departmentId || null,
        },
        select: { id: true, name: true, email: true, role: true, phone: true, departmentId: true, createdAt: true },
    });
}

export async function findOrCreateFirebaseUser(googleUid: string, email: string, name?: string, picture?: string, defaultRole = 'CITIZEN') {
    let user = await prisma.user.findFirst({
        where: {
            OR: [
                { googleUid },
                { email },
            ],
        },
    });

    if (!user) {
        user = await prisma.user.create({
            data: {
                googleUid,
                email,
                name: name || 'Google Citizen',
                role: defaultRole.toUpperCase(),
                avatarUrl: picture || null,
            },
        });
    } else if (!user.googleUid) {
        // Link Google UID if registered with email earlier
        user = await prisma.user.update({
            where: { id: user.id },
            data: {
                googleUid,
                avatarUrl: user.avatarUrl || picture || null,
            },
        });
    }

    return user;
}

export async function findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
}

export async function findUserById(id: string) {
    return prisma.user.findUnique({
        where: { id },
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
            updatedAt: true,
        },
    });
}

export async function getUserWithPassword(id: string) {
    return prisma.user.findUnique({ where: { id } });
}

export function generateTokenId(): string {
    return crypto.randomUUID();
}

export async function hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, env.BCRYPT_SALT_ROUNDS);
}

export async function compareToken(token: string, hash: string): Promise<boolean> {
    return bcrypt.compare(token, hash);
}

export async function storeRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
    return prisma.refreshToken.create({
        data: { userId, tokenHash, expiresAt },
    });
}

export async function findRefreshTokenById(id: string) {
    return prisma.refreshToken.findUnique({ where: { id } });
}

export async function revokeRefreshToken(id: string) {
    return prisma.refreshToken.update({
        where: { id },
        data: { revoked: true },
    });
}
