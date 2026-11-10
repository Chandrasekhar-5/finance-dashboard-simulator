import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import { AuthService } from '../../modules/auth/auth.service.js';
import { prismaMock } from '../setup.js';
import { AppError } from '../../utils/AppError.js';

describe('HIGH-04: Login User Enumeration Prevention', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns HTTP 401 with "Invalid email or password" when the email does not exist', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);

        let thrownError: any = null;
        try {
            await AuthService.login({
                email: 'nonexistent@example.com',
                password: 'Password123!',
            });
        } catch (err) {
            thrownError = err;
        }

        expect(thrownError).toBeInstanceOf(AppError);
        expect(thrownError.statusCode).toBe(401);
        expect(thrownError.message).toBe('Invalid email or password');
    });

    it('returns HTTP 401 with "Invalid email or password" when the password is incorrect', async () => {
        const hashedPassword = await bcrypt.hash('CorrectPassword123!', 10);
        prismaMock.user.findUnique.mockResolvedValue({
            id: '550e8400-e29b-41d4-a716-446655440001',
            email: 'registered@example.com',
            emailVerified: true,
            passwordHash: hashedPassword,
            firstName: 'Alice',
            lastName: 'Smith',
            createdAt: new Date(),
            updatedAt: new Date(),
        } as any);

        let thrownError: any = null;
        try {
            await AuthService.login({
                email: 'registered@example.com',
                password: 'WrongPassword999!',
            });
        } catch (err) {
            thrownError = err;
        }

        expect(thrownError).toBeInstanceOf(AppError);
        expect(thrownError.statusCode).toBe(401);
        expect(thrownError.message).toBe('Invalid email or password');
    });

    it('verifies non-existent user and wrong password produce identical status code and message', async () => {
        // 1. Non-existent user
        prismaMock.user.findUnique.mockResolvedValueOnce(null);
        let errorNonExistent: any;
        try {
            await AuthService.login({ email: 'ghost@example.com', password: 'SomePassword123!' });
        } catch (err) {
            errorNonExistent = err;
        }

        // 2. Existing user, wrong password
        const hashedPassword = await bcrypt.hash('RealPassword123!', 10);
        prismaMock.user.findUnique.mockResolvedValueOnce({
            id: '550e8400-e29b-41d4-a716-446655440002',
            email: 'real@example.com',
            emailVerified: true,
            passwordHash: hashedPassword,
        } as any);
        let errorWrongPassword: any;
        try {
            await AuthService.login({ email: 'real@example.com', password: 'WrongPassword123!' });
        } catch (err) {
            errorWrongPassword = err;
        }

        // Must be completely indistinguishable to prevent user enumeration
        expect(errorNonExistent.statusCode).toBe(401);
        expect(errorWrongPassword.statusCode).toBe(401);
        expect(errorNonExistent.message).toBe(errorWrongPassword.message);
        expect(errorNonExistent.message).toBe('Invalid email or password');
    });
});
