import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtAccessPayload, JwtRefreshPayload } from '../types/jwt-payload';

export function signAccessToken(payload: JwtAccessPayload): string {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
        expiresIn: env.JWT_ACCESS_EXPIRY as SignOptions['expiresIn'],
    });
}

export function verifyAccessToken(token: string): JwtAccessPayload {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload;
}

export function signRefreshToken(payload: JwtRefreshPayload): string {
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
        expiresIn: env.JWT_REFRESH_EXPIRY as SignOptions['expiresIn'],
    });
}

export function verifyRefreshToken(token: string): JwtRefreshPayload {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtRefreshPayload;
}