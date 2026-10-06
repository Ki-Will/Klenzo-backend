// Habit Service RPC Contracts

export type HabitFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type HabitStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type LogStatus = 'COMPLETED' | 'SKIPPED' | 'FAILED';

export interface HabitSummary {
  id: string;
  userId: string;
  name: string;
  description?: string;
  frequency: HabitFrequency;
  targetCount: number;
  currentStreak: number;
  longestStreak: number;
  status: HabitStatus;
  color?: string;
  icon?: string;
  reminderTime?: string; // HH:MM
  createdAt: string;
  updatedAt: string;
}

export interface HabitLogSummary {
  id: string;
  habitId: string;
  userId: string;
  status: LogStatus;
  note?: string;
  completedAt: string;
  scheduledDate: string;
}

// Create habit
export interface CreateHabitRequest {
  userId: string;
  name: string;
  description?: string;
  frequency: HabitFrequency;
  targetCount?: number;
  color?: string;
  icon?: string;
  reminderTime?: string;
}

export interface CreateHabitResponse {
  habit: HabitSummary;
}

// Update habit
export interface UpdateHabitRequest {
  habitId: string;
  userId: string;
  name?: string;
  description?: string;
  frequency?: HabitFrequency;
  targetCount?: number;
  status?: HabitStatus;
  color?: string;
  icon?: string;
  reminderTime?: string;
}

export interface UpdateHabitResponse {
  habit: HabitSummary;
}

// Get habit
export interface GetHabitRequest {
  habitId: string;
  userId: string;
}

export interface GetHabitResponse {
  habit: HabitSummary;
}

// List habits
export interface ListHabitsRequest {
  userId: string;
  status?: HabitStatus;
  frequency?: HabitFrequency;
  page?: number;
  pageSize?: number;
}

export interface ListHabitsResponse {
  habits: HabitSummary[];
  total: number;
  page: number;
  pageSize: number;
}

// Log habit
export interface LogHabitRequest {
  habitId: string;
  userId: string;
  status: LogStatus;
  note?: string;
  completedAt?: string;
  scheduledDate: string;
}

export interface LogHabitResponse {
  log: HabitLogSummary;
  habit: HabitSummary; // Updated habit with new streak data
}

// Delete habit
export interface DeleteHabitRequest {
  habitId: string;
  userId: string;
}

export interface DeleteHabitResponse {
  success: boolean;
}

// Get habit logs
export interface GetHabitLogsRequest {
  habitId: string;
  userId: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface GetHabitLogsResponse {
  logs: HabitLogSummary[];
  total: number;
}
