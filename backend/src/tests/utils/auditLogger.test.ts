import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '../setup.js';
import { AuditLogger, extractRequestContext, sanitizeMetadata } from '../../utils/auditLogger.js';
import { AuthService } from '../../modules/auth/auth.service.js';
import { EmailVerificationService } from '../../utils/emailVerification.js';
import { TransactionService } from '../../modules/transactions/transaction.service.js';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import type { Request } from 'express';

describe('AuditLogger Unit Tests (Phase 5)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('AuditLogger.log core helper', () => {
        it('creates an audit log with correct action, resource, userId, and metadata', async () => {
            prismaMock.auditLog.create.mockResolvedValue({
                id: 'audit-1',
                userId: 'user-123',
                action: 'LOGIN',
                resource: 'AUTH',
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0',
                metadata: { email: 'test@example.com' },
                createdAt: new Date(),
            } as any);

            await AuditLogger.log({
                userId: 'user-123',
                action: 'LOGIN',
                resource: 'AUTH',
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0',
                metadata: { email: 'test@example.com' },
            });

            expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
            expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
                data: {
                    userId: 'user-123',
                    action: 'LOGIN',
                    resource: 'AUTH',
                    ipAddress: '192.168.1.1',
                    userAgent: 'Mozilla/5.0',
                    metadata: { email: 'test@example.com' },
                },
            });
        });

        it('supports nullable user IDs for unauthenticated actions', async () => {
            prismaMock.auditLog.create.mockResolvedValue({} as any);

            await AuditLogger.log({
                userId: null,
                action: 'LOGIN',
                resource: 'AUTH',
                ipAddress: '10.0.0.1',
                userAgent: 'curl/7.68.0',
            });

            expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        userId: null,
                        action: 'LOGIN',
                    }),
                })
            );
        });

        it('preserves structured metadata and converts Prisma.Decimal to string', () => {
            const rawMeta = {
                amount: new Prisma.Decimal('1500.50'),
                fee: new Prisma.Decimal('0.00'),
                nested: {
                    limit: new Prisma.Decimal('50000.00'),
                    note: 'transfer details',
                },
            };

            const sanitized = sanitizeMetadata(rawMeta);

            expect(sanitized).toEqual({
                amount: '1500.5',
                fee: '0',
                nested: {
                    limit: '50000',
                    note: 'transfer details',
                },
            });
        });

        it('scrubs sensitive credentials from metadata (passwords, tokens, secrets, hashes)', () => {
            const rawMeta = {
                email: 'user@example.com',
                password: 'supersecretpassword',
                passwordHash: '$2b$10$hashedpassword',
                token: 'jwt-token-string',
                refreshToken: 'refresh-token-string',
                accessToken: 'access-token-string',
                secret: 'client-secret-value',
                clientSecret: 'oauth-client-secret',
                newPassword: 'new-plain-password',
                currentPassword: 'current-plain-password',
                safeData: 'safe-value',
            };

            const sanitized = sanitizeMetadata(rawMeta) as Record<string, unknown>;

            expect(sanitized.email).toBe('user@example.com');
            expect(sanitized.safeData).toBe('safe-value');
            expect(sanitized.password).toBeUndefined();
            expect(sanitized.passwordHash).toBeUndefined();
            expect(sanitized.token).toBeUndefined();
            expect(sanitized.refreshToken).toBeUndefined();
            expect(sanitized.accessToken).toBeUndefined();
            expect(sanitized.secret).toBeUndefined();
            expect(sanitized.clientSecret).toBeUndefined();
            expect(sanitized.newPassword).toBeUndefined();
            expect(sanitized.currentPassword).toBeUndefined();
        });

        it('swallows audit database errors gracefully without throwing (best-effort logging)', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            prismaMock.auditLog.create.mockRejectedValue(new Error('DB connection failed'));

            await expect(
                AuditLogger.log({
                    userId: 'user-1',
                    action: 'LOGIN',
                    resource: 'AUTH',
                })
            ).resolves.not.toThrow();

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[AuditLogger] Failed to write audit log for action LOGIN: DB connection failed')
            );
            consoleSpy.mockRestore();
        });

        it('extractRequestContext correctly parses IP (stripping ::ffff:) and user-agent', () => {
            const mockReq = {
                ip: '::ffff:192.168.1.100',
                headers: {
                    'user-agent': 'Vitest-Test-Agent/1.0',
                },
            } as unknown as Request;

            const context = extractRequestContext(mockReq);
            expect(context.ipAddress).toBe('192.168.1.100');
            expect(context.userAgent).toBe('Vitest-Test-Agent/1.0');
        });
    });

    describe('Audit logging integration across auth and banking flows', () => {
        it('emits ACCOUNT_CREATED audit on successful registration', async () => {
            prismaMock.user.findUnique.mockResolvedValue(null);
            prismaMock.$transaction.mockImplementation(async (fn: Function) => {
                const txMock = {
                    user: {
                        create: vi.fn().mockResolvedValue({
                            id: 'user-new',
                            email: 'newuser@example.com',
                        }),
                    },
                    account: {
                        create: vi.fn().mockResolvedValue({ id: 'acc-1' }),
                    },
                };
                return fn(txMock);
            });
            prismaMock.auditLog.create.mockResolvedValue({} as any);

            await AuthService.register(
                {
                    firstName: 'Alice',
                    lastName: 'Smith',
                    email: 'newuser@example.com',
                    password: 'password123',
                },
                { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
            );

            expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId: 'user-new',
                    action: 'ACCOUNT_CREATED',
                    resource: 'ACCOUNT',
                    ipAddress: '127.0.0.1',
                    userAgent: 'test-agent',
                    metadata: {
                        email: 'newuser@example.com',
                    },
                }),
            });
        });

        it('emits LOGIN audit on successful login', async () => {
            const passwordHash = await bcrypt.hash('password123', 10);
            prismaMock.user.findUnique.mockResolvedValue({
                id: 'user-login',
                email: 'login@example.com',
                emailVerified: true,
                passwordHash,
            } as any);
            prismaMock.auditLog.create.mockResolvedValue({} as any);

            await AuthService.login(
                { email: 'login@example.com', password: 'password123' },
                { ipAddress: '10.0.0.5', userAgent: 'Chrome/100' },
                { ipAddress: '10.0.0.5', userAgent: 'Chrome/100' }
            );

            expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId: 'user-login',
                    action: 'LOGIN',
                    resource: 'AUTH',
                    ipAddress: '10.0.0.5',
                    userAgent: 'Chrome/100',
                    metadata: {
                        email: 'login@example.com',
                    },
                }),
            });
        });

        it('emits EMAIL_VERIFIED audit on successful email verification', async () => {
            prismaMock.emailVerification.findFirst.mockResolvedValue({
                id: 'ev-1',
                userId: 'user-ev',
                user: { email: 'verified@example.com' },
            } as any);
            prismaMock.user.update.mockResolvedValue({} as any);
            prismaMock.emailVerification.update.mockResolvedValue({} as any);
            prismaMock.auditLog.create.mockResolvedValue({} as any);

            await EmailVerificationService.verifyEmail('valid-token', {
                ipAddress: '1.2.3.4',
                userAgent: 'Firefox',
            });

            expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId: 'user-ev',
                    action: 'EMAIL_VERIFIED',
                    resource: 'AUTH',
                    ipAddress: '1.2.3.4',
                    userAgent: 'Firefox',
                    metadata: {
                        email: 'verified@example.com',
                    },
                }),
            });
        });

        it('emits PASSWORD_CHANGED audit on password change', async () => {
            const currentHash = await bcrypt.hash('currentPass123', 10);
            prismaMock.user.findUnique.mockResolvedValue({
                id: 'user-pw',
                passwordHash: currentHash,
            } as any);
            prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
            prismaMock.auditLog.create.mockResolvedValue({} as any);

            await AuthService.changePassword('user-pw', 'currentPass123', 'newSecretPassword123', {
                ipAddress: '10.10.10.10',
                userAgent: 'Safari',
            });

            expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId: 'user-pw',
                    action: 'PASSWORD_CHANGED',
                    resource: 'AUTH',
                    ipAddress: '10.10.10.10',
                    userAgent: 'Safari',
                    metadata: {
                        method: 'CHANGE',
                    },
                }),
            });
        });

        it('emits PASSWORD_CHANGED audit on password reset', async () => {
            prismaMock.passwordReset.findFirst.mockResolvedValue({
                id: 'pr-1',
                userId: 'user-reset',
                expiresAt: new Date(Date.now() + 100000),
            } as any);
            prismaMock.passwordReset.updateMany.mockResolvedValue({ count: 1 });
            prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
            prismaMock.auditLog.create.mockResolvedValue({} as any);

            await AuthService.resetPassword('reset-token', 'newSecretPassword123', {
                ipAddress: '10.10.10.20',
                userAgent: 'Edge',
            });

            expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId: 'user-reset',
                    action: 'PASSWORD_CHANGED',
                    resource: 'AUTH',
                    metadata: {
                        method: 'RESET',
                    },
                }),
            });
        });

        it('emits SESSION_REVOKED audit on single session revocation', async () => {
            prismaMock.auditLog.create.mockResolvedValue({} as any);

            await AuthService.revokeSession('session-123', 'user-sess', {
                ipAddress: '127.0.0.1',
                userAgent: 'Mobile App',
            });

            expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId: 'user-sess',
                    action: 'SESSION_REVOKED',
                    resource: 'SESSION',
                    metadata: {
                        sessionId: 'session-123',
                        scope: 'SINGLE',
                    },
                }),
            });
        });

        it('emits SESSION_REVOKED audit on logoutAllDevices', async () => {
            prismaMock.auditLog.create.mockResolvedValue({} as any);

            await AuthService.logoutAllDevices('user-sess', {
                ipAddress: '127.0.0.1',
                userAgent: 'Desktop Browser',
            });

            expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId: 'user-sess',
                    action: 'SESSION_REVOKED',
                    resource: 'SESSION',
                    metadata: {
                        scope: 'ALL',
                    },
                }),
            });
        });

        it('emits TRANSFER audit record on successful transfer with decimal amount string', async () => {
            const sender = {
                id: 'acc-sender',
                userId: 'user-sender',
                accountNumber: '1111111111',
                type: 'CHECKING',
                status: 'ACTIVE',
                balance: '5000.0000',
                currency: 'INR',
            };
            const receiver = {
                id: 'acc-receiver',
                userId: 'user-receiver',
                accountNumber: '2222222222',
                type: 'CHECKING',
                status: 'ACTIVE',
                balance: '1000.0000',
                currency: 'INR',
            };
            const record = {
                id: 'tx-1',
                reference: 'ref-audit-transfer',
                amount: new Prisma.Decimal('500.00'),
                type: 'TRANSFER',
                status: 'COMPLETED',
                fromAccountId: 'acc-sender',
                toAccountId: 'acc-receiver',
                createdAt: new Date(),
            };

            prismaMock.account.findFirst.mockResolvedValue(sender as any);
            prismaMock.account.findUnique.mockResolvedValue(receiver as any);
            prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
            prismaMock.account.updateMany.mockResolvedValue({ count: 1 });
            prismaMock.transaction.create.mockResolvedValue(record as any);
            prismaMock.auditLog.create.mockResolvedValue({} as any);

            await TransactionService.transferMoney(
                'user-sender',
                {
                    fromAccountId: 'acc-sender',
                    toAccountId: 'acc-receiver',
                    amount: '500.00',
                    reference: 'ref-audit-transfer',
                },
                { ipAddress: '192.168.1.50', userAgent: 'BankingMobile/2.0' }
            );

            expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId: 'user-sender',
                    action: 'TRANSFER',
                    resource: 'TRANSACTION',
                    ipAddress: '192.168.1.50',
                    userAgent: 'BankingMobile/2.0',
                    metadata: {
                        transactionId: 'tx-1',
                        reference: 'ref-audit-transfer',
                        fromAccountId: 'acc-sender',
                        toAccountId: 'acc-receiver',
                        amount: new Prisma.Decimal('500.00').toString(),
                        type: 'TRANSFER',
                        status: 'COMPLETED',
                    },
                }),
            });
        });

        it('does NOT create a TRANSFER audit record if transfer fails or is rejected', async () => {
            const sender = {
                id: 'acc-sender',
                userId: 'user-sender',
                accountNumber: '1111111111',
                type: 'CHECKING',
                status: 'ACTIVE',
                balance: '100.0000',
                currency: 'INR',
            };

            prismaMock.account.findFirst.mockResolvedValue(sender as any);
            prismaMock.account.findUnique.mockResolvedValue(null); // Receiver not found

            await expect(
                TransactionService.transferMoney('user-sender', {
                    fromAccountId: 'acc-sender',
                    toAccountId: 'acc-nonexistent',
                    amount: '50.00',
                    reference: 'ref-fail-transfer',
                })
            ).rejects.toThrow();

            // No audit log should be emitted for TRANSFER
            expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
        });
    });
});
