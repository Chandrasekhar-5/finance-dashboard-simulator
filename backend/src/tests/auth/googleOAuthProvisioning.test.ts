import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleGoogleAuth } from '../../config/passport.js';
import { prismaMock } from '../setup.js';
import { EmailService } from '../../services/email.service.js';
import { Prisma } from '@prisma/client';

// Mock EmailService
vi.mock('../../services/email.service.js', () => ({
    EmailService: {
        sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
        sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    },
}));

describe('CRIT-02: Google OAuth Account Provisioning', () => {
    const mockProfile = {
        id: 'google-profile-123',
        displayName: 'John Doe',
        emails: [{ value: 'johndoe@gmail.com' }],
        photos: [{ value: 'https://example.com/avatar.jpg' }],
    } as any;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('provisions a checking account with 10-digit account number atomically for new Google OAuth users', async () => {
        // Neither oauthAccount nor existingUser exists
        prismaMock.oAuthAccount.findUnique.mockResolvedValue(null);
        prismaMock.user.findUnique.mockResolvedValue(null);

        const mockNewUser = {
            id: 'user-oauth-1',
            email: 'johndoe@gmail.com',
            emailVerified: true,
            firstName: 'John',
            lastName: 'Doe',
            avatar: 'https://example.com/avatar.jpg',
        };

        // $transaction executes callback with prismaMock
        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.user.create.mockResolvedValue(mockNewUser);
        prismaMock.account.create.mockResolvedValue({
            id: 'acc-oauth-1',
            userId: 'user-oauth-1',
            accountNumber: '1234567890',
            type: 'CHECKING',
            status: 'ACTIVE',
            balance: new Prisma.Decimal('1000.00'),
            currency: 'INR',
        });

        const done = vi.fn();
        await handleGoogleAuth('mock-access', 'mock-refresh', mockProfile, done);

        expect(done).toHaveBeenCalledWith(null, mockNewUser);
        expect(prismaMock.$transaction).toHaveBeenCalledOnce();
        expect(prismaMock.user.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    email: 'johndoe@gmail.com',
                    emailVerified: true,
                    firstName: 'John',
                    lastName: 'Doe',
                }),
            })
        );
        expect(prismaMock.account.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    userId: 'user-oauth-1',
                    type: 'CHECKING',
                    status: 'ACTIVE',
                    currency: 'INR',
                    balance: new Prisma.Decimal('1000.00'),
                    accountNumber: expect.stringMatching(/^\d{10}$/),
                }),
            })
        );
        expect(EmailService.sendWelcomeEmail).toHaveBeenCalledWith('johndoe@gmail.com', 'John');
    });

    it('does not create a duplicate bank account for existing OAuth users', async () => {
        const existingOauthUser = {
            id: 'user-existing-oauth',
            email: 'johndoe@gmail.com',
        };

        prismaMock.oAuthAccount.findUnique.mockResolvedValue({
            id: 'oauth-acc-1',
            provider: 'google',
            providerId: 'google-profile-123',
            user: existingOauthUser,
        } as any);

        prismaMock.$transaction.mockResolvedValue([{}, {}]);

        const done = vi.fn();
        await handleGoogleAuth('mock-access', 'mock-refresh', mockProfile, done);

        expect(done).toHaveBeenCalledWith(null, existingOauthUser);
        // Did not create any new user or bank account
        expect(prismaMock.user.create).not.toHaveBeenCalled();
        expect(prismaMock.account.create).not.toHaveBeenCalled();
    });

    it('does not create a duplicate bank account when linking Google to existing email/password user', async () => {
        // oauthAccount does not exist, but user with email already exists
        prismaMock.oAuthAccount.findUnique.mockResolvedValue(null);
        const existingUser = {
            id: 'user-existing-local',
            email: 'johndoe@gmail.com',
            oauthAccounts: [],
        };
        prismaMock.user.findUnique.mockResolvedValue(existingUser as any);
        prismaMock.oAuthAccount.create.mockResolvedValue({} as any);

        const done = vi.fn();
        await handleGoogleAuth('mock-access', 'mock-refresh', mockProfile, done);

        expect(done).toHaveBeenCalledWith(null, existingUser);
        expect(prismaMock.oAuthAccount.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    userId: 'user-existing-local',
                    provider: 'google',
                    providerId: 'google-profile-123',
                }),
            })
        );
        // Bank account should NOT be created again
        expect(prismaMock.account.create).not.toHaveBeenCalled();
    });

    it('retries account number generation on P2002 collision and succeeds', async () => {
        prismaMock.oAuthAccount.findUnique.mockResolvedValue(null);
        prismaMock.user.findUnique.mockResolvedValue(null);

        const mockNewUser = { id: 'user-retry-1', email: 'johndoe@gmail.com' };
        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.user.create.mockResolvedValue(mockNewUser);

        const collisionError = Object.assign(new Error('Unique constraint'), {
            code: 'P2002',
            meta: { target: ['accountNumber'] },
        });

        prismaMock.account.create
            .mockRejectedValueOnce(collisionError)
            .mockResolvedValueOnce({ id: 'acc-retry-ok' });

        const done = vi.fn();
        await handleGoogleAuth('mock-access', 'mock-refresh', mockProfile, done);

        expect(done).toHaveBeenCalledWith(null, mockNewUser);
        expect(prismaMock.account.create).toHaveBeenCalledTimes(2);
    });

    it('fails and passes error to done if account creation fails after 3 collisions', async () => {
        prismaMock.oAuthAccount.findUnique.mockResolvedValue(null);
        prismaMock.user.findUnique.mockResolvedValue(null);

        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.user.create.mockResolvedValue({ id: 'user-fail-1', email: 'johndoe@gmail.com' });

        const collisionError = Object.assign(new Error('Unique constraint'), {
            code: 'P2002',
            meta: { target: ['accountNumber'] },
        });

        prismaMock.account.create.mockRejectedValue(collisionError);

        const done = vi.fn();
        await handleGoogleAuth('mock-access', 'mock-refresh', mockProfile, done);

        expect(done).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining('Account creation failed'),
            })
        );
        expect(prismaMock.account.create).toHaveBeenCalledTimes(3);
    });

    it('passes error to done if Google profile has no email', async () => {
        const done = vi.fn();
        await handleGoogleAuth('mock-access', 'mock-refresh', { id: 'no-email', displayName: 'Anon' } as any, done);

        expect(done).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining('No email found from Google'),
            })
        );
    });
});
