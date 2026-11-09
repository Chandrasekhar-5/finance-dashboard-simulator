import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailVerificationService } from '../../utils/emailVerification.js';
import { prismaMock } from '../setup.js';
import { EmailService } from '../../services/email.service.js';

// Mock EmailService
vi.mock('../../services/email.service.js', () => ({
    EmailService: {
        sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    },
}));

describe('CRIT-03: EmailVerificationService.resendVerificationEmail', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('generates a new token and actually dispatches the verification email', async () => {
        const mockUser = {
            id: 'user-unverified-1',
            email: 'unverified@example.com',
            emailVerified: false,
        };

        prismaMock.user.findUnique.mockResolvedValue(mockUser as any);
        prismaMock.emailVerification.deleteMany.mockResolvedValue({ count: 1 });
        prismaMock.emailVerification.create.mockResolvedValue({ id: 'tok-1' } as any);

        await EmailVerificationService.resendVerificationEmail('unverified@example.com');

        // Old tokens invalidated
        expect(prismaMock.emailVerification.deleteMany).toHaveBeenCalledWith({
            where: {
                userId: 'user-unverified-1',
                usedAt: null,
                expiresAt: { gt: expect.any(Date) },
            },
        });

        // New token record created with 24h expiry
        expect(prismaMock.emailVerification.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    userId: 'user-unverified-1',
                    tokenHash: expect.any(String),
                    expiresAt: expect.any(Date),
                }),
            })
        );

        // Verification email dispatched via EmailService
        expect(EmailService.sendVerificationEmail).toHaveBeenCalledOnce();
        expect(EmailService.sendVerificationEmail).toHaveBeenCalledWith(
            'unverified@example.com',
            expect.any(String)
        );
    });

    it('throws AppError(400) if user is already email verified', async () => {
        const mockVerifiedUser = {
            id: 'user-verified-1',
            email: 'verified@example.com',
            emailVerified: true,
        };

        prismaMock.user.findUnique.mockResolvedValue(mockVerifiedUser as any);

        await expect(
            EmailVerificationService.resendVerificationEmail('verified@example.com')
        ).rejects.toMatchObject({
            statusCode: 400,
            message: 'Email already verified',
        });

        expect(EmailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('silently returns without sending email or throwing if user does not exist (prevents enumeration)', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);

        await expect(
            EmailVerificationService.resendVerificationEmail('nonexistent@example.com')
        ).resolves.toBeUndefined();

        expect(EmailService.sendVerificationEmail).not.toHaveBeenCalled();
        expect(prismaMock.emailVerification.create).not.toHaveBeenCalled();
    });

    it('handles email delivery failure by throwing an AppError(500)', async () => {
        const mockUser = {
            id: 'user-unverified-1',
            email: 'unverified@example.com',
            emailVerified: false,
        };

        prismaMock.user.findUnique.mockResolvedValue(mockUser as any);
        prismaMock.emailVerification.deleteMany.mockResolvedValue({ count: 1 });
        prismaMock.emailVerification.create.mockResolvedValue({ id: 'tok-1' } as any);

        // Simulate Resend API failure
        vi.mocked(EmailService.sendVerificationEmail).mockRejectedValueOnce(new Error('Resend network error'));

        await expect(
            EmailVerificationService.resendVerificationEmail('unverified@example.com')
        ).rejects.toMatchObject({
            statusCode: 500,
            message: expect.stringContaining('Failed to send verification email'),
        });
    });
});
