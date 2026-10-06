// Insight Service RPC Contracts

export type InsightType =
  | 'HABIT_STREAK'
  | 'SPENDING_PATTERN'
  | 'PRODUCTIVITY_TREND'
  | 'FINANCIAL_HEALTH'
  | 'GOAL_PROGRESS'
  | 'ANOMALY_DETECTION';

export type InsightSeverity = 'INFO' | 'WARNING' | 'POSITIVE' | 'CRITICAL';
export type AnalyticsPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export interface InsightSummary {
  id: string;
  userId: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  description: string;
  data: Record<string, unknown>;
  actionable: boolean;
  actionUrl?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface AnalyticsSummary {
  period: AnalyticsPeriod;
  startDate: string;
  endDate: string;
  metrics: Record<string, number | string>;
  trends: Array<{
    label: string;
    value: number;
    change: number; // Percentage change
    direction: 'UP' | 'DOWN' | 'FLAT';
  }>;
}

export interface HabitAnalytics {
  totalHabits: number;
  activeHabits: number;
  completionRate: number;
  longestStreak: number;
  currentStreaks: Array<{ habitId: string; habitName: string; streak: number }>;
  completionsByDay: Array<{ date: string; completed: number; total: number }>;
}

export interface FinanceAnalytics {
  totalIncome: string;
  totalExpenses: string;
  netSavings: string;
  savingsRate: number;
  topSpendingCategories: Array<{ category: string; amount: string; percentage: number }>;
  cashFlowByMonth: Array<{ month: string; income: string; expenses: string }>;
}

export interface ProductivityAnalytics {
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  averageCompletionTime: number; // minutes
  tasksByPriority: Record<string, number>;
  completionsByDay: Array<{ date: string; completed: number; created: number }>;
}

// Get insight
export interface GetInsightRequest {
  insightId: string;
  userId: string;
}

export interface GetInsightResponse {
  insight: InsightSummary;
}

// List insights
export interface ListInsightsRequest {
  userId: string;
  type?: InsightType;
  severity?: InsightSeverity;
  actionableOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ListInsightsResponse {
  insights: InsightSummary[];
  total: number;
  page: number;
  pageSize: number;
}

// Get analytics
export interface GetAnalyticsRequest {
  userId: string;
  domain: 'HABIT' | 'FINANCE' | 'PRODUCTIVITY' | 'OVERVIEW';
  period: AnalyticsPeriod;
  startDate?: string;
  endDate?: string;
}

export interface GetAnalyticsResponse {
  analytics: AnalyticsSummary;
  habitAnalytics?: HabitAnalytics;
  financeAnalytics?: FinanceAnalytics;
  productivityAnalytics?: ProductivityAnalytics;
}

// Generate insights (triggers async computation)
export interface GenerateInsightsRequest {
  userId: string;
  domains?: Array<'HABIT' | 'FINANCE' | 'PRODUCTIVITY'>;
}

export interface GenerateInsightsResponse {
  jobId: string;
  estimatedSeconds: number;
}
