import { z } from 'zod';
import { UuidSchema } from './common';

// ─── Shared Enums ─────────────────────────────────────────────────────────

export const TaskStatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'BLOCKED']);
export const TaskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

// ─── Create Task ──────────────────────────────────────────────────────────

export const CreateTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Task title is required')
    .max(255, 'Task title must be at most 255 characters'),
  description: z.string().trim().max(2000, 'Description must be at most 2000 characters').optional(),
  priority: TaskPrioritySchema.default('MEDIUM'),
  dueDate: z.string().datetime({ message: 'dueDate must be ISO 8601' }).optional(),
  tags: z
    .array(z.string().trim().min(1).max(50))
    .max(20, 'Cannot add more than 20 tags')
    .default([]),
  parentTaskId: UuidSchema.optional(),
  projectId: UuidSchema.optional(),
  estimatedMinutes: z.number().int().min(1).max(14400).optional(), // max 10 days
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

// ─── Update Task ──────────────────────────────────────────────────────────

export const UpdateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(2000).optional(),
    status: TaskStatusSchema.optional(),
    priority: TaskPrioritySchema.optional(),
    dueDate: z.string().datetime().optional().nullable(),
    tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
    estimatedMinutes: z.number().int().min(1).max(14400).optional(),
    actualMinutes: z.number().int().min(0).max(14400).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided for update',
  });

export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

// ─── List Tasks Query ─────────────────────────────────────────────────────

export const ListTasksQuerySchema = z.object({
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  projectId: UuidSchema.optional(),
  parentTaskId: UuidSchema.optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['dueDate', 'priority', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListTasksQueryInput = z.infer<typeof ListTasksQuerySchema>;
