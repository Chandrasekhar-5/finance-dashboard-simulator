import { describe, it, expect, vi } from 'vitest';
import { prismaMock } from '../setup.js';
import { AccountService } from '../../modules/accounts/account.service.js';
import { AppError } from '../../utils/AppError.js';

// ---------------------------------------------------------------------------
// AccountService — smoke tests (Phase 0)
// ---------------------------------------------------------------------------

describe('AccountService.getUserAccounts', () => {
    it('returns accounts for the given userId', async () => {
        const mockAccounts = [
            {
                id: 'acc-1',
                userId: 'user-1',
                accountNumber: '1234567890',
                type: 'CHECKING',
                status: 'ACTIVE',
                balance: '1000.0000',
                currency: 'INR',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ];

        prismaMock.account.findMany.mockResolvedValue(mockAccounts);

        const result = await AccountService.getUserAccounts('user-1');

        expect(result).toEqual(mockAccounts);
        expect(prismaMock.account.findMany).toHaveBeenCalledOnce();
        expect(prismaMock.account.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { userId: 'user-1' } })
        );
    });

    it('returns an empty array when user has no accounts', async () => {
        prismaMock.account.findMany.mockResolvedValue([]);

        const result = await AccountService.getUserAccounts('user-no-accounts');

        expect(result).toEqual([]);
    });
});

describe('AccountService.getAccountById', () => {
    it('returns the account when found and owned by the user', async () => {
        const mockAccount = {
            id: 'acc-1',
            userId: 'user-1',
            accountNumber: '1234567890',
            type: 'CHECKING',
            status: 'ACTIVE',
            balance: '1000.0000',
            currency: 'INR',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        prismaMock.account.findFirst.mockResolvedValue(mockAccount);

        const result = await AccountService.getAccountById('user-1', 'acc-1');

        expect(result).toEqual(mockAccount);
        expect(prismaMock.account.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 'acc-1', userId: 'user-1' } })
        );
    });

    it('throws AppError(400) when account is not found or not owned', async () => {
        prismaMock.account.findFirst.mockResolvedValue(null);

        await expect(AccountService.getAccountById('user-1', 'acc-other'))
            .rejects.toThrow(AppError);

        await expect(AccountService.getAccountById('user-1', 'acc-other'))
            .rejects.toMatchObject({ statusCode: 400 });
    });
});
