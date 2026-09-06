import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { getProfile } from '../controllers/auth.controller';
import { prisma } from '../prisma/client';
import { sendSuccess, sendError } from '../utils/apiResponse.util';
import { httpStatus } from '../config/http_status';
import { z } from 'zod';

const router = Router();

const updateProfileSchema = z.object({
    name: z.string().min(1).optional(),
    phone: z.string().optional(),
    avatarUrl: z.string().url().optional(),
});

// ── User Profile Routes ──
router.get('/me', authenticate, getProfile);
router.get('/each_user_profile', authenticate, getProfile);

router.patch('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const validated = updateProfileSchema.parse(req.body);
        const user = req.user!;

        const updated = await prisma.user.update({
            where: { id: user.sub },
            data: validated,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                phone: true,
                avatarUrl: true,
                departmentId: true,
                updatedAt: true,
            },
        });

        return sendSuccess(res, updated, httpStatus.OK, 'Profile updated successfully.');
    } catch (err) {
        next(err);
    }
});

export default router;
