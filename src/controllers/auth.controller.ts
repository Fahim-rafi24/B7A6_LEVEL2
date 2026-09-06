import { Request, Response, NextFunction } from 'express';
import { signupSchema, loginSchema, firebaseGoogleAuthSchema } from '../validators/auth.validator';
import jwt from 'jsonwebtoken';
import { comparePassword } from '../utils/hash.util';
import {
    createUser,
    findUserByEmail,
    findUserById,
    findOrCreateFirebaseUser,
    findRefreshTokenById,
    revokeRefreshToken,
} from '../services/auth.service';
import { issueTokenPair, rotateRefreshToken } from '../services/token.service';
import { verifyFirebaseIdToken } from '../config/firebase';
import { recordAuditLog } from '../services/audit.service';
import { sendLoginAlertEmail } from '../services/email.service';
import { sendSuccess, sendError } from '../utils/apiResponse.util';
import { env } from '../config/env';
import { httpStatus } from '../config/http_status';

export async function signup(req: Request, res: Response, next: NextFunction) {
    try {
        const { name, email, password, role, phone, departmentId } = signupSchema.parse(req.body);

        const existing = await findUserByEmail(email);
        if (existing) {
            return sendError(res, httpStatus.CONFLICT, 'Email already registered.');
        }

        const user = await createUser(name, email, password, role || 'CITIZEN', phone, departmentId);
        const tokens = await issueTokenPair(user.id, user.role);

        res.cookie('accessToken', tokens.accessToken, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: env.ACCESS_TOKEN_MAX_AGE,
        });
        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: env.REFRESH_TOKEN_MAX_AGE,
        });

        await recordAuditLog({
            actorId: user.id,
            actorName: user.name,
            actorRole: user.role,
            action: 'USER_REGISTER',
            targetType: 'User',
            targetId: user.id,
            targetTitle: user.email,
            details: `New account created with role ${user.role}`,
        });

        return sendSuccess(
            res,
            {
                user,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            },
            httpStatus.CREATED,
            'Registration successful.'
        );
    } catch (err) {
        next(err);
    }
}

export async function login(req: Request, res: Response, next: NextFunction) {
    try {
        const { email, password } = loginSchema.parse(req.body);

        const user = await findUserByEmail(email);
        if (!user || !user.password) {
            return sendError(res, httpStatus.UNAUTHORIZED, 'Invalid email or password.');
        }

        const valid = await comparePassword(password, user.password);
        if (!valid) {
            return sendError(res, httpStatus.UNAUTHORIZED, 'Invalid email or password.');
        }

        const tokens = await issueTokenPair(user.id, user.role);

        res.cookie('accessToken', tokens.accessToken, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: env.ACCESS_TOKEN_MAX_AGE,
        });
        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: env.REFRESH_TOKEN_MAX_AGE,
        });

        const { password: _, ...safeUser } = user;

        await recordAuditLog({
            actorId: user.id,
            actorName: user.name,
            actorRole: user.role,
            action: 'USER_LOGIN',
            targetType: 'User',
            targetId: user.id,
            targetTitle: user.email,
            details: `Signed in as ${user.role}`,
        });

        // Trigger Login Email Security Alert asynchronously (does not block response)
        sendLoginAlertEmail({
            to: user.email,
            userName: user.name,
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
            loginTime: new Date(),
        }).catch((err) => console.error('Failed to dispatch login email alert:', err));

        return sendSuccess(
            res,
            {
                user: safeUser,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            },
            httpStatus.OK,
            'Login successful.'
        );
    } catch (err) {
        next(err);
    }
}

// ── Firebase Google OAuth (GCP) ──
export async function firebaseGoogleLogin(req: Request, res: Response, next: NextFunction) {
    try {
        const { idToken, role } = firebaseGoogleAuthSchema.parse(req.body);

        const decoded = await verifyFirebaseIdToken(idToken);
        const user = await findOrCreateFirebaseUser(
            decoded.uid,
            decoded.email,
            decoded.name,
            decoded.picture,
            role || 'CITIZEN'
        );

        const tokens = await issueTokenPair(user.id, user.role);

        res.cookie('accessToken', tokens.accessToken, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: env.ACCESS_TOKEN_MAX_AGE,
        });
        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: env.REFRESH_TOKEN_MAX_AGE,
        });

        const { password: _, ...safeUser } = user;

        await recordAuditLog({
            actorId: user.id,
            actorName: user.name,
            actorRole: user.role,
            action: 'FIREBASE_GOOGLE_LOGIN',
            targetType: 'User',
            targetId: user.id,
            targetTitle: user.email,
            details: `Authenticated via Firebase Google OAuth as ${user.role}`,
        });

        // Trigger Login Email Security Alert asynchronously
        sendLoginAlertEmail({
            to: user.email,
            userName: user.name,
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
            loginTime: new Date(),
        }).catch((err) => console.error('Failed to dispatch google login email alert:', err));

        return sendSuccess(
            res,
            {
                user: safeUser,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            },
            httpStatus.OK,
            'Firebase Google login successful.'
        );
    } catch (err) {
        next(err);
    }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
    try {
        let token = req.cookies?.refreshToken;
        if (!token && req.body?.refreshToken) {
            token = req.body.refreshToken;
        }

        if (!token) {
            return sendError(res, httpStatus.UNAUTHORIZED, 'No refresh token provided.');
        }

        const tokens = await rotateRefreshToken(token);

        res.cookie('accessToken', tokens.accessToken, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: env.ACCESS_TOKEN_MAX_AGE,
        });
        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: env.REFRESH_TOKEN_MAX_AGE,
        });

        return sendSuccess(res, tokens, httpStatus.OK, 'Token refreshed successfully.');
    } catch (err) {
        next(err);
    }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
    try {
        const token = req.cookies?.refreshToken || req.body?.refreshToken;
        if (token) {
            const decoded = jwt.decode(token) as { jti?: string } | null;
            const jti = decoded?.jti;
            if (jti) {
                const stored = await findRefreshTokenById(jti);
                if (stored && !stored.revoked) {
                    await revokeRefreshToken(jti);
                }
            }
        }

        res.clearCookie('accessToken', {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: 'strict',
        });
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: 'strict',
        });

        return sendSuccess(res, null, httpStatus.OK, 'Logged out successfully.');
    } catch (err) {
        next(err);
    }
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
    try {
        const user = await findUserById(req.user!.sub);
        if (!user) {
            return sendError(res, httpStatus.NOT_FOUND, 'User not found.');
        }
        return sendSuccess(res, user, httpStatus.OK, 'Profile fetched.');
    } catch (err) {
        next(err);
    }
}
