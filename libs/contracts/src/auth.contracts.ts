// Auth Service Contracts
//
// ValidateToken*/GetUserProfile* mirror the gRPC messages in
// libs/proto/auth.proto (source of truth for the gRPC surface).
// Register/Login/Refresh/Profile messages model the shared HTTP/Worker API
// surface and have no proto counterpart yet.

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

// Token validation — mirrors auth.proto ValidateToken{Request,Response}
export interface ValidateTokenRequest {
  token: string;
}

export interface ValidateTokenResponse {
  isValid: boolean;
  userId: string;
  email: string;
  role: string;
  isActive: boolean;
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

// Get user profile — mirrors auth.proto GetUserProfile{Request,Response}
export interface GetUserProfileRequest {
  userId: string;
}

export interface GetUserProfileResponse {
  id: string;
  email: string;
  name: string;
  phone: string;
  avatar: string;
  role: string;
  isActive: boolean;
  createdAt: string;
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
