export interface ValidateTokenRequest {
    token: string;
}

export interface ValidateTokenResponse {
    isValid: boolean;
    userId?: string;
    email?: string;
}
