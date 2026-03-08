export enum NatsSubjects {
  // Auth & User Events
  USER_CREATED = 'user.created',
  USER_LOGGED_IN = 'user.logged_in',

  // Finance Events
  TRANSACTION_CREATED = 'transaction.created',
  BUDGET_THRESHOLD_REACHED = 'budget.threshold.reached',

  // Productivity Events
  TASK_COMPLETED = 'task.completed',
  TASK_OVERDUE = 'task.overdue',

  // Habit Events
  HABIT_COMPLETED = 'habit.completed',
  HABIT_STREAK_UPDATED = 'habit.streak.updated',

  // Request-Reply Subjects (RPC over NATS)
  AUTH_VALIDATE_TOKEN = 'auth.validate_token',
}
