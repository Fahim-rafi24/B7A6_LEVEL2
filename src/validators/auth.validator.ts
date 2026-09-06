import { z } from 'zod';

export const signupSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    email: z.string().email('Invalid email format'),
    password: z
        .string()
        .min(6, 'Password must be at least 6 characters long'),
    role: z
        .enum(['CITIZEN', 'STAFF', 'ADMIN'])
        .optional()
        .default('CITIZEN'),
    phone: z.string().optional(),
    departmentId: z.string().optional(),
});

export const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
});

export const firebaseGoogleAuthSchema = z.object({
    idToken: z.string().min(1, 'Firebase ID token is required'),
    role: z.enum(['CITIZEN', 'STAFF', 'ADMIN']).optional().default('CITIZEN'),
});
