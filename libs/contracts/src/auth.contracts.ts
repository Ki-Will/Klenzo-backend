// Auth Service RPC Contracts
// Mirrors the gRPC service definitions in libs/proto/auth.proto

export interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

export interface AuthClaims {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// Register
export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
}

export interface RegisterResponse {
  user: UserSummary;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Login
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: UserSummary;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Token validation
export interface ValidateTokenRequest {
  token: string;
}

export interface ValidateTokenResponse {
  valid: boolean;
  claims: AuthClaims | null;
  error?: string;
}

// Refresh token
export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Get user
export interface GetUserRequest {
  userId: string;
}

export interface GetUserResponse {
  user: UserSummary;
}

// Update profile
export interface UpdateProfileRequest {
  userId: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  avatarUrl?: string;
}

export interface UpdateProfileResponse {
  user: UserSummary;
}

// Change password
export interface ChangePasswordRequest {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  success: boolean;
}

// Logout
export interface LogoutRequest {
  userId: string;
  refreshToken: string;
}

export interface LogoutResponse {
  success: boolean;
}
