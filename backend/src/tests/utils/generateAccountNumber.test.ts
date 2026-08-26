import { describe, it, expect, vi } from 'vitest';
import { generateAccountNumber } from '../../utils/generateAccountNumber.js';
import { prismaMock } from '../setup.js';
import { AuthService } from '../../modules/auth/auth.service.js';
import bcrypt from 'bcrypt';
import { EmailVerificationService } from '../../utils/emailVerification.js';
import { EmailService } from '../../services/email.service.js';

// Mock dependency modules for AuthService tests
vi.mock('../../utils/emailVerification.js', () => ({
    EmailVerificationService: {
        generateVerificationToken: vi.fn().mockResolvedValue('mock-token'),
    },
}));

vi.mock('../../services/email.service.js', () => ({
    EmailService: {
        sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    },
}));

describe('generateAccountNumber', () => {
    it('returns a string of exactly 10 digits in range 1000000000..9999999999', () => {
        for (let i = 0; i < 50; i++) {
            const accNo = generateAccountNumber();
            expect(accNo).toMatch(/^\d{10}$/);
            const num = BigInt(accNo);
            expect(num).toBeGreaterThanOrEqual(1000000000n);
            expect(num).toBeLessThanOrEqual(9999999999n);
        }
    });

    it('does not use Math.random', () => {
        const mathRandomSpy = vi.spyOn(Math, 'random');
        generateAccountNumber();
        expect(mathRandomSpy).not.toHaveBeenCalled();
        mathRandomSpy.mockRestore();
    });

    it('generates unique numbers across 1000 iterations', () => {
        const set = new Set<string>();
        for (let i = 0; i < 1000; i++) {
            set.add(generateAccountNumber());
        }
        expect(set.size).toBe(1000);
    });
});

describe('AuthService.register - Account Number Collision Retry', () => {
    it('retries account creation on P2002 collision and succeeds on retry', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);

        const mockUser = {
            id: 'user-new',
            email: 'new@example.com',
            firstName: 'New',
            lastName: 'User',
            passwordHash: 'hashed',
            emailVerified: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        // $transaction wrapper
        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.user.create.mockResolvedValue(mockUser);

        // First call to account.create fails with P2002 collision on accountNumber, second succeeds
        const collisionError = Object.assign(new Error('Unique constraint'), {
            code: 'P2002',
            meta: { target: ['accountNumber'] },
        });

        prismaMock.account.create
            .mockRejectedValueOnce(collisionError)
            .mockResolvedValueOnce({
                id: 'acc-1',
                userId: 'user-new',
                accountNumber: '1234567890',
                type: 'CHECKING',
                status: 'ACTIVE',
                balance: '1000.00',
                currency: 'INR',
                createdAt: new Date(),
                updatedAt: new Date(),
            });

        prismaMock.refreshToken.create.mockResolvedValue({} as any);

        const result = await AuthService.register({
            firstName: 'New',
            lastName: 'User',
            email: 'new@example.com',
            password: 'Password123!',
        });

        expect(result).toHaveProperty('accessToken');
        expect(result).toHaveProperty('refreshToken');
        expect(prismaMock.account.create).toHaveBeenCalledTimes(2);
    });

    it('throws AppError after 3 failed collision attempts', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);

        const mockUser = {
            id: 'user-fail',
            email: 'fail@example.com',
            firstName: 'Fail',
            lastName: 'User',
            passwordHash: 'hashed',
            emailVerified: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.user.create.mockResolvedValue(mockUser);

        const collisionError = Object.assign(new Error('Unique constraint'), {
            code: 'P2002',
            meta: { target: ['accountNumber'] },
        });

        prismaMock.account.create.mockRejectedValue(collisionError);

        await expect(
            AuthService.register({
                firstName: 'Fail',
                lastName: 'User',
                email: 'fail@example.com',
                password: 'Password123!',
            })
        ).rejects.toMatchObject({
            statusCode: 500,
            message: expect.stringContaining('Account creation failed'),
        });

        expect(prismaMock.account.create).toHaveBeenCalledTimes(3);
    });
});

