import { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200, message?: string) {
    return res.status(statusCode).json({
        statusCode,
        success: statusCode < 400 ? true : false,
        message: message || 'Request successful',
        data,
    });
}

export function sendError(res: Response, statusCode: number, message: string, errors?: unknown) {
    return res.status(statusCode).json({
        statusCode,
        success: false,
        message,
        errors: errors || undefined,
    });
}
