// Productivity Service RPC Contracts

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED' | 'BLOCKED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TaskSummary {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string; // ISO 8601
  completedAt?: string;
  tags: string[];
  parentTaskId?: string;
  projectId?: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

// Create task
export interface CreateTaskRequest {
  userId: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  tags?: string[];
  parentTaskId?: string;
  projectId?: string;
  estimatedMinutes?: number;
}

export interface CreateTaskResponse {
  task: TaskSummary;
}

// Update task
export interface UpdateTaskRequest {
  taskId: string;
  userId: string;
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  tags?: string[];
  estimatedMinutes?: number;
  actualMinutes?: number;
}

export interface UpdateTaskResponse {
  task: TaskSummary;
}

// Get task
export interface GetTaskRequest {
  taskId: string;
  userId: string;
}

export interface GetTaskResponse {
  task: TaskSummary;
}

// List tasks
export interface ListTasksRequest {
  userId: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  parentTaskId?: string;
  dueBefore?: string;
  dueAfter?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
  sortBy?: 'dueDate' | 'priority' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ListTasksResponse {
  tasks: TaskSummary[];
  total: number;
  page: number;
  pageSize: number;
}

// Delete task
export interface DeleteTaskRequest {
  taskId: string;
  userId: string;
}

export interface DeleteTaskResponse {
  success: boolean;
}

// Complete task
export interface CompleteTaskRequest {
  taskId: string;
  userId: string;
  actualMinutes?: number;
}

export interface CompleteTaskResponse {
  task: TaskSummary;
}
