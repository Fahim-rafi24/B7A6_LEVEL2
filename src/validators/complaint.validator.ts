import { z } from 'zod';

export const createComplaintSchema = z.object({
    title: z.string().min(3, 'Title must be at least 3 characters').max(150),
    description: z.string().min(10, 'Description must be at least 10 characters'),
    category: z.string().min(2, 'Category is required'),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
    location: z.string().min(3, 'Location is required'),
    latitude: z.coerce.number().optional(),
    longitude: z.coerce.number().optional(),
    imageUrl: z.string().optional(),
    isPremiumService: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional().default(false),
    serviceFee: z.coerce.number().positive().optional(),
    departmentId: z.string().uuid().optional(),
});

export const updateComplaintSchema = z.object({
    title: z.string().min(3).max(150).optional(),
    description: z.string().min(10).optional(),
    category: z.string().min(2).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    location: z.string().min(3).optional(),
    imageUrl: z.string().optional(),
});

export const assignComplaintSchema = z.object({
    departmentId: z.string().min(1, 'Department ID is required'),
    assignedStaffId: z.string().nullable().optional(),
});

export const updateStatusSchema = z.object({
    status: z.enum(['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED']),
    content: z.string().min(2, 'Summary content is required'),
    desc: z.string().optional(),
});

export const feedbackSchema = z.object({
    rating: z.number().int().min(1).max(5, 'Rating must be between 1 and 5'),
    comment: z.string().max(500).optional(),
});

export const softDeleteSchema = z.object({
    reason: z.string().max(300).optional(),
});
