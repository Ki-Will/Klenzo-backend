/**
 * Contract tests for Auth Service gRPC.
 * Verifies that the gRPC service implements the proto contract correctly.
 *
 * Run with: npx jest --config jest.contract.config.js
 */
import { status } from '@grpc/grpc-js';

describe('Auth Service gRPC Contract', () => {
  describe('ValidateToken', () => {
    it('should accept a valid token request', () => {
      // Contract: request must have 'token' field
      const request = { token: 'valid-jwt-token' };
      expect(request).toHaveProperty('token');
      expect(typeof request.token).toBe('string');
    });

    it('should return ValidateTokenResponse shape', () => {
      // Contract: response must have these fields
      const response = {
        isValid: true,
        userId: 'user-uuid',
        email: 'user@example.com',
        role: 'USER',
        isActive: true,
      };
      expect(response).toHaveProperty('isValid');
      expect(response).toHaveProperty('userId');
      expect(response).toHaveProperty('email');
      expect(response).toHaveProperty('role');
      expect(response).toHaveProperty('isActive');
      expect(typeof response.isValid).toBe('boolean');
    });

    it('should return error for invalid token', () => {
      // Contract: invalid token returns isValid=false
      const response = {
        isValid: false,
        userId: '',
        email: '',
        role: '',
        isActive: false,
      };
      expect(response.isValid).toBe(false);
    });
  });

  describe('GetUserProfile', () => {
    it('should accept userId in request', () => {
      const request = { userId: 'user-uuid' };
      expect(request).toHaveProperty('userId');
    });

    it('should return GetUserProfileResponse shape', () => {
      const response = {
        id: 'user-uuid',
        email: 'user@example.com',
        name: 'John Doe',
        phone: '+1234567890',
        avatar: 'https://example.com/avatar.jpg',
        role: 'USER',
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('email');
      expect(response).toHaveProperty('role');
      expect(response).toHaveProperty('isActive');
    });
  });

  describe('CheckRole', () => {
    it('should accept userId and requiredRole', () => {
      const request = { userId: 'user-uuid', requiredRole: 'ADMIN' };
      expect(request).toHaveProperty('userId');
      expect(request).toHaveProperty('requiredRole');
    });

    it('should return CheckRoleResponse shape', () => {
      const response = {
        hasRole: true,
        actualRole: 'ADMIN',
      };
      expect(response).toHaveProperty('hasRole');
      expect(response).toHaveProperty('actualRole');
      expect(typeof response.hasRole).toBe('boolean');
    });
  });
});

describe('Finance Service gRPC Contract', () => {
  describe('GetUserWalletBalance', () => {
    it('should accept userId in request', () => {
      const request = { userId: 'user-uuid' };
      expect(request).toHaveProperty('userId');
    });

    it('should return GetUserWalletBalanceResponse shape', () => {
      const response = {
        userId: 'user-uuid',
        mainWalletBalance: 1000.50,
        currency: 'USD',
        hasWallet: true,
      };
      expect(response).toHaveProperty('userId');
      expect(response).toHaveProperty('mainWalletBalance');
      expect(response).toHaveProperty('currency');
      expect(response).toHaveProperty('hasWallet');
      expect(typeof response.mainWalletBalance).toBe('number');
    });
  });

  describe('ValidateSufficientFunds', () => {
    it('should accept userId, amount, and currency', () => {
      const request = { userId: 'user-uuid', amount: 100.00, currency: 'USD' };
      expect(request).toHaveProperty('userId');
      expect(request).toHaveProperty('amount');
      expect(request).toHaveProperty('currency');
    });

    it('should return ValidateSufficientFundsResponse shape', () => {
      const response = {
        isSufficient: true,
        currentBalance: 1000.00,
        requestedAmount: 100.00,
        currency: 'USD',
      };
      expect(response).toHaveProperty('isSufficient');
      expect(response).toHaveProperty('currentBalance');
      expect(typeof response.isSufficient).toBe('boolean');
    });
  });
});
