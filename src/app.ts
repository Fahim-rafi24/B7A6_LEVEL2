import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import complaintRoutes from './routes/complaint.routes';
import paymentRoutes from './routes/payment.routes';
import adminRoutes from './routes/admin.routes';
import { errorHandler } from './middlewares/error.middleware';
import { apiLimiter } from './middlewares/rateLimiter.middleware';
import { env } from './config/env';
import { sendError, sendSuccess } from './utils/apiResponse.util';
import { httpStatus } from './config/http_status';

import path from 'path';

const app = express();

// ── Trust Proxy for Vercel / Reverse Proxies ──
app.set('trust proxy', 1);

// ── Security Headers & Rate Limiting ──
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(apiLimiter);

// ── CORS & Body Parsers ──
app.use(cors({
    origin: [env.SITE_URL, 'http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
}));
app.use(express.json({ limit: env.URL_FILE_SIZE }));
app.use(express.urlencoded({ extended: true, limit: env.URL_FILE_SIZE }));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));
app.use(cookieParser());

// ── Health Check ──
app.get('/', (req: Request, res: Response) => {
    return sendSuccess(res, {
        name: 'CityCare Pro API (City Complaint & Service Platform)',
        version: '1.0.0',
        environment: env.NODE_ENV,
        timestamp: new Date().toISOString(),
        documentation: '/api/v1/health',
    }, httpStatus.OK, 'CityCare Pro API Server is up and running 🏙️');
});

app.get('/api/v1/health', (req: Request, res: Response) => {
    return sendSuccess(res, {
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    }, httpStatus.OK, 'System operational');
});

// ── API Version 1 Routes ──
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/complaints', complaintRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/admin', adminRoutes);

// ── Backwards Compatible Route Aliases ──
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/payments', paymentRoutes);

// ── 404 Route Handler ──
app.use((req: Request, res: Response) => {
    return sendError(res, httpStatus.NOT_FOUND, `Route '${req.method} ${req.originalUrl}' not found.`);
});

// ── Global Error Handler ──
app.use(errorHandler);

export default app;
