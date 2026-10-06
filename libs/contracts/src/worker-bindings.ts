// Cloudflare Worker Binding Interfaces
// Used for typed service bindings in wrangler.toml [services] config

import type {
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
  ValidateTokenRequest,
  ValidateTokenResponse,
  GetUserRequest,
  GetUserResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  LogoutRequest,
  LogoutResponse,
} from './auth.contracts';

import type {
  GetWalletBalanceRequest,
  GetWalletBalanceResponse,
  CreateTransactionRequest,
  CreateTransactionResponse,
  GetTransactionsRequest,
  GetTransactionsResponse,
  CreateAccountRequest,
  CreateAccountResponse,
  GetUserAccountsRequest,
  GetUserAccountsResponse,
  CreateTransferRequest,
  CreateTransferResponse,
  CreateBudgetRequest,
  CreateBudgetResponse,
} from './finance.contracts';

import type {
  SendNotificationRequest,
  CreateNotificationRequest,
  CreateNotificationResponse,
  DeviceTokenRequest,
  DeviceTokenResponse,
  GetNotificationsRequest,
  GetNotificationsResponse,
  MarkNotificationReadRequest,
  MarkNotificationReadResponse,
} from './notification.contracts';

import type {
  CreateHabitRequest,
  CreateHabitResponse,
  UpdateHabitRequest,
  UpdateHabitResponse,
  GetHabitRequest,
  GetHabitResponse,
  ListHabitsRequest,
  ListHabitsResponse,
  LogHabitRequest,
  LogHabitResponse,
} from './habit.contracts';

import type {
  CreateTaskRequest,
  CreateTaskResponse,
  UpdateTaskRequest,
  UpdateTaskResponse,
  GetTaskRequest,
  GetTaskResponse,
  ListTasksRequest,
  ListTasksResponse,
} from './productivity.contracts';

import type {
  GetInsightRequest,
  GetInsightResponse,
  ListInsightsRequest,
  ListInsightsResponse,
  GetAnalyticsRequest,
  GetAnalyticsResponse,
} from './insight.contracts';

/**
 * Auth Worker RPC Binding
 * Bound via wrangler.toml: [[services]] binding = "AUTH_SERVICE"
 */
export interface AuthWorkerBinding {
  register(req: RegisterRequest): Promise<RegisterResponse>;
  login(req: LoginRequest): Promise<LoginResponse>;
  validateToken(req: ValidateTokenRequest): Promise<ValidateTokenResponse>;
  refreshToken(req: RefreshTokenRequest): Promise<RefreshTokenResponse>;
  getUser(req: GetUserRequest): Promise<GetUserResponse>;
  logout(req: LogoutRequest): Promise<LogoutResponse>;
  // Standard Worker fetch for HTTP requests
  fetch(request: Request): Promise<Response>;
}

/**
 * Finance Worker RPC Binding
 * Bound via wrangler.toml: [[services]] binding = "FINANCE_SERVICE"
 */
export interface FinanceWorkerBinding {
  getWalletBalance(req: GetWalletBalanceRequest): Promise<GetWalletBalanceResponse>;
  createTransaction(req: CreateTransactionRequest): Promise<CreateTransactionResponse>;
  getTransactions(req: GetTransactionsRequest): Promise<GetTransactionsResponse>;
  createAccount(req: CreateAccountRequest): Promise<CreateAccountResponse>;
  getUserAccounts(req: GetUserAccountsRequest): Promise<GetUserAccountsResponse>;
  createTransfer(req: CreateTransferRequest): Promise<CreateTransferResponse>;
  createBudget(req: CreateBudgetRequest): Promise<CreateBudgetResponse>;
  fetch(request: Request): Promise<Response>;
}

/**
 * Notification Worker RPC Binding
 * Bound via wrangler.toml: [[services]] binding = "NOTIFICATION_SERVICE"
 */
export interface NotificationWorkerBinding {
  sendNotification(req: SendNotificationRequest): Promise<void>;
  createNotification(req: CreateNotificationRequest): Promise<CreateNotificationResponse>;
  getNotifications(req: GetNotificationsRequest): Promise<GetNotificationsResponse>;
  markAsRead(req: MarkNotificationReadRequest): Promise<MarkNotificationReadResponse>;
  registerDeviceToken(req: DeviceTokenRequest): Promise<DeviceTokenResponse>;
  fetch(request: Request): Promise<Response>;
}

/**
 * Habit Worker RPC Binding
 * Bound via wrangler.toml: [[services]] binding = "HABIT_SERVICE"
 */
export interface HabitWorkerBinding {
  createHabit(req: CreateHabitRequest): Promise<CreateHabitResponse>;
  updateHabit(req: UpdateHabitRequest): Promise<UpdateHabitResponse>;
  getHabit(req: GetHabitRequest): Promise<GetHabitResponse>;
  listHabits(req: ListHabitsRequest): Promise<ListHabitsResponse>;
  logHabit(req: LogHabitRequest): Promise<LogHabitResponse>;
  fetch(request: Request): Promise<Response>;
}

/**
 * Productivity Worker RPC Binding
 * Bound via wrangler.toml: [[services]] binding = "PRODUCTIVITY_SERVICE"
 */
export interface ProductivityWorkerBinding {
  createTask(req: CreateTaskRequest): Promise<CreateTaskResponse>;
  updateTask(req: UpdateTaskRequest): Promise<UpdateTaskResponse>;
  getTask(req: GetTaskRequest): Promise<GetTaskResponse>;
  listTasks(req: ListTasksRequest): Promise<ListTasksResponse>;
  fetch(request: Request): Promise<Response>;
}

/**
 * Insight Worker RPC Binding
 * Bound via wrangler.toml: [[services]] binding = "INSIGHT_SERVICE"
 */
export interface InsightWorkerBinding {
  getInsight(req: GetInsightRequest): Promise<GetInsightResponse>;
  listInsights(req: ListInsightsRequest): Promise<ListInsightsResponse>;
  getAnalytics(req: GetAnalyticsRequest): Promise<GetAnalyticsResponse>;
  fetch(request: Request): Promise<Response>;
}
