import { env } from '../config/env';
import { JwtAccessPayload, JwtRefreshPayload } from '../types/jwt-payload';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.util';
import { generateTokenId, hashToken, storeRefreshToken, compareToken, findRefreshTokenById, revokeRefreshToken } from './auth.service';

export async function issueTokenPair(userId: string, role: string) {
    const jti = generateTokenId();
    const accessPayload: JwtAccessPayload = { sub: userId, role };
    const refreshPayload: JwtRefreshPayload = { sub: userId, jti };

    const accessToken = signAccessToken(accessPayload);
    const refreshToken = signRefreshToken(refreshPayload);

    // store into DB refresh token with hash and expiration time
    const tokenHash = await hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_MAX_AGE);
    await storeRefreshToken(userId, tokenHash, expiresAt);

    return { accessToken, refreshToken };
}

export async function rotateRefreshToken(oldRefreshToken: string) {
    const payload = verifyRefreshToken(oldRefreshToken);
    const stored = await findRefreshTokenById(payload.jti);
    if (!stored || stored.revoked) {
        throw new Error('Invalid or revoked refresh token');
    }

    const tokenMatches = await compareToken(oldRefreshToken, stored.tokenHash);
    if (!tokenMatches) {
        throw new Error('Refresh token mismatch');
    }

    await revokeRefreshToken(stored.id);
    return issueTokenPair(payload.sub, 'user');
}

