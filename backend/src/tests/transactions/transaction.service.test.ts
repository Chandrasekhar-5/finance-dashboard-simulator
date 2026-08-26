import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { prismaMock } from '../setup.js';
import { TransactionService } from '../../modules/transactions/transaction.service.js';
import { AppError } from '../../utils/AppError.js';

// ---------------------------------------------------------------------------
// Shared test data helpers
// ---------------------------------------------------------------------------

const makeSenderAccount = (overrides = {}) => ({
    id: 'acc-sender',
    userId: 'user-1',
    accountNumber: '1111111111',
    type: 'CHECKING' as const,
    status: 'ACTIVE' as const,
    balance: new Prisma.Decimal('5000.0000'),
    currency: 'INR',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

const makeReceiverAccount = (overrides = {}) => ({
    id: 'acc-receiver',
    userId: 'user-2',
    accountNumber: '2222222222',
    type: 'CHECKING' as const,
    status: 'ACTIVE' as const,
    balance: new Prisma.Decimal('1000.0000'),
    currency: 'INR',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

const makeTransactionRecord = (overrides = {}) => ({
    id: 'txn-1',
    reference: 'ref-uuid-1234',
    amount: new Prisma.Decimal('100.0000'),
    type: 'TRANSFER' as const,
    status: 'COMPLETED' as const,
    description: null,
    fromAccountId: 'acc-sender',
    toAccountId: 'acc-receiver',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

// ---------------------------------------------------------------------------
// TransactionService.transferMoney — smoke tests (Phase 0)
// ---------------------------------------------------------------------------

describe('TransactionService.transferMoney', () => {

    it('rejects when fromAccountId === toAccountId', async () => {
        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-1',
                toAccountId:   'acc-1',
                amount:        100,
                reference:     'ref-uuid-same',
            })
        ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('same account') });

        // Should not touch the DB at all
        expect(prismaMock.account.findFirst).not.toHaveBeenCalled();
    });

    it('rejects when sender account is not found or not owned by user', async () => {
        prismaMock.account.findFirst.mockResolvedValue(null);

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-other',
                toAccountId:   'acc-receiver',
                amount:        100,
                reference:     'ref-uuid-notfound',
            })
        ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('completes a valid transfer and returns the transaction record', async () => {
        const sender   = makeSenderAccount();
        const record   = makeTransactionRecord();

        // sender ownership check
        prismaMock.account.findFirst.mockResolvedValue(sender);

        // prisma.$transaction resolves to whatever the inner async fn returns
        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));

        // updateMany for sender (balance guard) — count: 1 = success
        prismaMock.account.updateMany
            .mockResolvedValueOnce({ count: 1 })   // sender decrement
            .mockResolvedValueOnce({ count: 1 });  // receiver increment

        // transaction.create resolves to our record
        prismaMock.transaction.create.mockResolvedValue(record);

        const result = await TransactionService.transferMoney('user-1', {
            fromAccountId: 'acc-sender',
            toAccountId:   'acc-receiver',
            amount:        100,
            reference:     'ref-uuid-valid',
        });

        expect(result).toEqual(record);
        expect(prismaMock.transaction.create).toHaveBeenCalledOnce();
        expect(prismaMock.transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ status: 'COMPLETED', type: 'TRANSFER' })
            })
        );
    });

    it('rejects with "Insufficient funds" when sender balance guard fails', async () => {
        const sender = makeSenderAccount();

        prismaMock.account.findFirst.mockResolvedValue(sender);

        // Inner $transaction fn receives the tx mock; updateMany returns count: 0
        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany.mockResolvedValueOnce({ count: 0 }); // balance check fails

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        99999,
                reference:     'ref-uuid-nofunds',
            })
        ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Insufficient') });
    });

    it('throws 409 on duplicate reference (P2002)', async () => {
        const sender = makeSenderAccount();

        prismaMock.account.findFirst.mockResolvedValue(sender);

        const prismaError = Object.assign(new Error('Unique constraint'), {
            code: 'P2002',
            meta: { target: ['reference'] },
        });

        prismaMock.$transaction.mockRejectedValue(prismaError);

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        100,
                reference:     'ref-uuid-duplicate',
            })
        ).rejects.toMatchObject({ statusCode: 409 });
    });
});

// ---------------------------------------------------------------------------
// TransactionService.getTransactionHistory — smoke tests (Phase 0)
// ---------------------------------------------------------------------------

describe('TransactionService.getTransactionHistory', () => {

    it('rejects when account is not found or not owned', async () => {
        prismaMock.account.findFirst.mockResolvedValue(null);

        await expect(
            TransactionService.getTransactionHistory('user-1', 'acc-other', 10)
        ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('returns paginated transactions with direction annotation', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());

        const transactions = [
            {
                ...makeTransactionRecord(),
                fromAccount: { user: { firstName: 'Alice', lastName: 'A' } },
                toAccount:   { user: { firstName: 'Bob',   lastName: 'B' } },
            }
        ];

        prismaMock.transaction.findMany.mockResolvedValue(transactions);

        const result = await TransactionService.getTransactionHistory('user-1', 'acc-sender', 10);

        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toMatchObject({ direction: 'OUT', status: 'COMPLETED' });
        expect(result.nextCursor).toBeUndefined();
    });

    it('returns nextCursor when more records exist than the limit', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());

        // Return limit+1 records — service should pop the last one and return its id as cursor
        const transactions = Array.from({ length: 11 }, (_, i) => ({
            ...makeTransactionRecord({ id: `txn-${i}` }),
            fromAccount: { user: { firstName: 'Alice', lastName: 'A' } },
            toAccount:   { user: { firstName: 'Bob',   lastName: 'B' } },
        }));

        prismaMock.transaction.findMany.mockResolvedValue(transactions);

        const result = await TransactionService.getTransactionHistory('user-1', 'acc-sender', 10);

        expect(result.data).toHaveLength(10);
        expect(result.nextCursor).toBe('txn-10');
    });
});
