import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';
import { sendError } from '../utils/apiResponse.util';
import { rotateRefreshToken } from '../services/token.service';
import { env } from '../config/env';
import { httpStatus } from '../config/http_status';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
    try {
        // 1. Check Bearer token in Authorization header
        let token: string | undefined;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }

        // 2. Check accessToken cookie as fallback
        if (!token && req.cookies?.accessToken) {
            token = req.cookies.accessToken;
        }

        if (token) {
            try {
                const payload = verifyAccessToken(token);
                req.user = payload;
                return next();
            } catch {
                // Token invalid or expired, continue to refresh attempt if cookie exists
            }
        }

        // 3. Optional auto-refresh using refreshToken cookie if present
        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) {
            return sendError(res, httpStatus.UNAUTHORIZED, 'Access denied. Bearer token or valid session required.');
        }

        const tokens = await rotateRefreshToken(refreshToken);

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

        const payload = verifyAccessToken(tokens.accessToken);
        req.user = payload;
        next();
    } catch {
        return sendError(res, httpStatus.UNAUTHORIZED, 'Authentication failed. Please sign in again.');
    }
}

export function requireRoles(...roles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return sendError(res, httpStatus.UNAUTHORIZED, 'Authentication required to access this resource.');
        }

        const userRole = (req.user.role || '').toUpperCase();
        const allowed = roles.map(r => r.toUpperCase());

        if (!allowed.includes(userRole)) {
            return sendError(
                res,
                httpStatus.FORBIDDEN,
                `Forbidden: Role '${req.user.role}' does not have permission to access this resource. Allowed: [${roles.join(', ')}]`
            );
        }

        next();
    };
}