import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireEmailVerified } from '../../middleware/requireEmailVerification.js';
import accountRoutes from '../../modules/accounts/account.routes.js';
import transactionRoutes from '../../modules/transactions/transaction.routes.js';
import { prismaMock } from '../setup.js';
import { AppError } from '../../utils/AppError.js';

describe('CRIT-01: Email Verification Enforcement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('requireEmailVerified middleware', () => {
        it('throws 401 Unauthorized when req.user is missing', async () => {
            const req = {} as Request;
            const res = {} as Response;
            const next = vi.fn();

            await expect(requireEmailVerified(req, res, next)).rejects.toMatchObject({
                statusCode: 401,
                message: 'Unauthorized',
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('throws 403 Forbidden when user emailVerified is false', async () => {
            const req = { user: { id: 'user-unverified' } } as Request;
            const res = {} as Response;
            const next = vi.fn();

            prismaMock.user.findUnique.mockResolvedValue({
                id: 'user-unverified',
                emailVerified: false,
            } as any);

            await expect(requireEmailVerified(req, res, next)).rejects.toMatchObject({
                statusCode: 403,
                message: expect.stringContaining('Email verification required'),
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('throws 403 Forbidden when user record is not found in database', async () => {
            const req = { user: { id: 'user-not-found' } } as Request;
            const res = {} as Response;
            const next = vi.fn();

            prismaMock.user.findUnique.mockResolvedValue(null);

            await expect(requireEmailVerified(req, res, next)).rejects.toMatchObject({
                statusCode: 403,
                message: expect.stringContaining('Email verification required'),
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('calls next() successfully when user emailVerified is true', async () => {
            const req = { user: { id: 'user-verified' } } as Request;
            const res = {} as Response;
            const next = vi.fn();

            prismaMock.user.findUnique.mockResolvedValue({
                id: 'user-verified',
                emailVerified: true,
            } as any);

            await requireEmailVerified(req, res, next);

            expect(next).toHaveBeenCalledOnce();
            expect(next).toHaveBeenCalledWith(); // called with no error
        });
    });

    describe('Router Stack Enforcement', () => {
        it('ensures accountRoutes applies requireEmailVerified middleware to all routes', () => {
            // Find requireEmailVerified in account router middleware stack
            const hasEmailVerification = accountRoutes.stack.some(
                (layer: any) => layer.handle === requireEmailVerified || layer.name === 'requireEmailVerified'
            );

            expect(hasEmailVerification).toBe(true);
        });

        it('ensures transactionRoutes applies requireEmailVerified middleware to all routes', () => {
            // Find requireEmailVerified in transaction router middleware stack
            const hasEmailVerification = transactionRoutes.stack.some(
                (layer: any) => layer.handle === requireEmailVerified || layer.name === 'requireEmailVerified'
            );

            expect(hasEmailVerification).toBe(true);
        });

        it('verifies requireAuth runs before requireEmailVerified in accountRoutes', () => {
            const middlewareNames = accountRoutes.stack
                .map((l: any) => l.handle.name || l.name)
                .filter((name: string) => name === 'requireAuth' || name === 'requireEmailVerified');

            expect(middlewareNames).toEqual(['requireAuth', 'requireEmailVerified']);
        });

        it('verifies requireAuth runs before requireEmailVerified in transactionRoutes', () => {
            const middlewareNames = transactionRoutes.stack
                .map((l: any) => l.handle.name || l.name)
                .filter((name: string) => name === 'requireAuth' || name === 'requireEmailVerified');

            expect(middlewareNames).toEqual(['requireAuth', 'requireEmailVerified']);
        });
    });
});
