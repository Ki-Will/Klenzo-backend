import { z } from 'zod';

// ─── Shared Enums ─────────────────────────────────────────────────────────

export const HabitFrequencySchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY']);
export const HabitStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']);
export const LogStatusSchema = z.enum(['COMPLETED', 'SKIPPED', 'FAILED']);

// Reminder time: HH:MM (24-hour)
const ReminderTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Reminder time must be in HH:MM format (24-hour)');

// ─── Create Habit ─────────────────────────────────────────────────────────

export const CreateHabitSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Habit name is required')
    .max(120, 'Habit name must be at most 120 characters'),
  description: z.string().trim().max(500, 'Description must be at most 500 characters').optional(),
  frequency: HabitFrequencySchema,
  targetCount: z.number().int().min(1).max(100).default(1),
  color: z
    .string()
    .regex(/^#([0-9A-Fa-f]{6})$/, 'Color must be a hex code like #FF5733')
    .optional(),
  icon: z.string().max(50).optional(),
  reminderTime: ReminderTimeSchema.optional(),
});

export type CreateHabitInput = z.infer<typeof CreateHabitSchema>;

// ─── Update Habit ─────────────────────────────────────────────────────────

export const UpdateHabitSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).optional(),
    frequency: HabitFrequencySchema.optional(),
    targetCount: z.number().int().min(1).max(100).optional(),
    status: HabitStatusSchema.optional(),
    color: z
      .string()
      .regex(/^#([0-9A-Fa-f]{6})$/, 'Color must be a hex code like #FF5733')
      .optional(),
    icon: z.string().max(50).optional(),
    reminderTime: ReminderTimeSchema.optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided for update',
  });

export type UpdateHabitInput = z.infer<typeof UpdateHabitSchema>;

// ─── Log Habit ─────────────────────────────────────────────────────────────

export const LogHabitSchema = z.object({
  status: LogStatusSchema,
  note: z.string().trim().max(300, 'Note must be at most 300 characters').optional(),
  completedAt: z.string().datetime().optional(),
  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'scheduledDate must be YYYY-MM-DD format'),
});

export type LogHabitInput = z.infer<typeof LogHabitSchema>;
