import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { sendError } from '../utils/apiResponse.util';
import { env } from '../config/env';
import { httpStatus } from '../config/http_status';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
    if (err instanceof ZodError) {
        const messages = err.issues.map((e: { path: PropertyKey[]; message: string }) => `${e.path.join('.')}: ${e.message}`);
        return sendError(res, httpStatus.BAD_REQUEST, 'Validation failed', messages);
    }

    if (err instanceof TokenExpiredError) {
        return sendError(res, httpStatus.UNAUTHORIZED, 'Token expired');
    }

    if (err instanceof JsonWebTokenError) {
        return sendError(res, httpStatus.UNAUTHORIZED, 'Invalid token');
    }

    if (err.message === 'Invalid or revoked refresh token' || err.message === 'Refresh token mismatch') {
        return sendError(res, httpStatus.UNAUTHORIZED, err.message);
    }

    // Known client/business logic errors thrown as new Error(...)
    if (err.statusCode && err.statusCode < 500) {
        return sendError(res, err.statusCode, err.message);
    }

    if (err.message && (
        err.message.includes('not found') ||
        err.message.includes('free of charge') ||
        err.message.includes('already been paid') ||
        err.message.includes('Permission denied')
    )) {
        const code = err.message.includes('not found') ? httpStatus.NOT_FOUND : httpStatus.BAD_REQUEST;
        return sendError(res, code, err.message);
    }

    console.error('Unhandled error:', err);

    return sendError(res, httpStatus.INTERNAL_SERVER_ERROR, err.message || 'Internal server error');
}