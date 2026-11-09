import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { prismaMock } from '../setup.js';
import { TransactionService } from '../../modules/transactions/transaction.service.js';
import { transferSchema, getTransactionsSchema } from '../../modules/transactions/transaction.schema.js';
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
// TransactionService.transferMoney
// ---------------------------------------------------------------------------

describe('TransactionService.transferMoney', () => {

    it('rejects when fromAccountId === toAccountId', async () => {
        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-1',
                toAccountId:   'acc-1',
                amount:        '100.00',
                reference:     'ref-uuid-same',
            })
        ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('same account') });

        expect(prismaMock.account.findFirst).not.toHaveBeenCalled();
    });

    it('rejects when sender account is not found or not owned by user', async () => {
        prismaMock.account.findFirst.mockResolvedValue(null);

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-other',
                toAccountId:   'acc-receiver',
                amount:        '100.00',
                reference:     'ref-uuid-notfound',
            })
        ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('completes a valid transfer with decimal string and returns the transaction record', async () => {
        const sender = makeSenderAccount();
        const record = makeTransactionRecord({ amount: new Prisma.Decimal('100.5000') });

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));

        prismaMock.account.updateMany
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 1 });

        prismaMock.transaction.create.mockResolvedValue(record);

        const result = await TransactionService.transferMoney('user-1', {
            fromAccountId: 'acc-sender',
            toAccountId:   'acc-receiver',
            amount:        '100.50',
            reference:     'ref-uuid-valid',
        });

        expect(result).toEqual(record);
        expect(prismaMock.transaction.create).toHaveBeenCalledOnce();
        expect(prismaMock.transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: 'COMPLETED',
                    type: 'TRANSFER',
                    amount: new Prisma.Decimal('100.50'),
                })
            })
        );
    });

    it('preserves high precision decimal values (e.g. 100.1234)', async () => {
        const sender = makeSenderAccount();
        const record = makeTransactionRecord({ amount: new Prisma.Decimal('100.1234') });

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));

        prismaMock.account.updateMany
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 1 });

        prismaMock.transaction.create.mockResolvedValue(record);

        await TransactionService.transferMoney('user-1', {
            fromAccountId: 'acc-sender',
            toAccountId:   'acc-receiver',
            amount:        '100.1234',
            reference:     'ref-uuid-prec',
        });

        expect(prismaMock.transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    amount: new Prisma.Decimal('100.1234'),
                })
            })
        );
    });

    it('rejects zero or negative transfer amounts', async () => {
        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        '0.00',
                reference:     'ref-uuid-zero',
            })
        ).rejects.toMatchObject({ statusCode: 400 });

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        '-50.00',
                reference:     'ref-uuid-neg',
            })
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('rejects with "Insufficient funds" when sender balance guard fails', async () => {
        const sender = makeSenderAccount();

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany.mockResolvedValueOnce({ count: 0 });

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        '99999.00',
                reference:     'ref-uuid-nofunds',
            })
        ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Insufficient') });
    });

    it('supports boundary values (e.g. 0.01 minimum transfer)', async () => {
        const sender = makeSenderAccount();
        const record = makeTransactionRecord({ amount: new Prisma.Decimal('0.0100') });

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 1 });

        prismaMock.transaction.create.mockResolvedValue(record);

        const result = await TransactionService.transferMoney('user-1', {
            fromAccountId: 'acc-sender',
            toAccountId:   'acc-receiver',
            amount:        '0.01',
            reference:     'ref-uuid-min',
        });

        expect(result).toEqual(record);
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
                amount:        '100.00',
                reference:     'ref-uuid-duplicate',
            })
        ).rejects.toMatchObject({ statusCode: 409 });
    });
});

// ---------------------------------------------------------------------------
// Transfer Limits (Phase 3)
// ---------------------------------------------------------------------------

describe('TransactionService.transferMoney - Transfer Limits', () => {

    it('rejects transfer amount below minimum limit (0.01)', async () => {
        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        '0.005',
                reference:     'ref-below-min',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('below minimum limit'),
        });
    });

    it('accepts transfer amount exactly equal to minimum limit (0.01)', async () => {
        const sender = makeSenderAccount({ balance: new Prisma.Decimal('100.00') });
        const record = makeTransactionRecord({ amount: new Prisma.Decimal('0.01') });

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 1 });
        prismaMock.transaction.create.mockResolvedValue(record);

        const result = await TransactionService.transferMoney('user-1', {
            fromAccountId: 'acc-sender',
            toAccountId:   'acc-receiver',
            amount:        '0.01',
            reference:     'ref-exact-min',
        });

        expect(result).toEqual(record);
    });

    it('accepts transfer amount exactly equal to maximum per-transaction limit (1,000,000)', async () => {
        const sender = makeSenderAccount({ balance: new Prisma.Decimal('2000000.00') });
        const record = makeTransactionRecord({ amount: new Prisma.Decimal('1000000.00') });

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 1 });
        prismaMock.transaction.create.mockResolvedValue(record);

        const result = await TransactionService.transferMoney('user-1', {
            fromAccountId: 'acc-sender',
            toAccountId:   'acc-receiver',
            amount:        '1000000.00',
            reference:     'ref-exact-max',
        });

        expect(result).toEqual(record);
    });

    it('rejects transfer amount above maximum per-transaction limit (1,000,000.01)', async () => {
        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        '1000000.01',
                reference:     'ref-above-max',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('exceeds maximum per-transaction limit'),
        });
    });

    it('rejects transfer when daily aggregate limit (5,000,000) is exceeded', async () => {
        const sender = makeSenderAccount({ balance: new Prisma.Decimal('10000000.00') });
        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.transaction.aggregate.mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal('4500000.00') } });

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        '600000.00',
                reference:     'ref-daily-limit',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('Daily transfer limit exceeded'),
        });
    });

    it('rejects transfer when monthly aggregate limit (50,000,000) is exceeded', async () => {
        const sender = makeSenderAccount({ balance: new Prisma.Decimal('100000000.00') });
        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.transaction.aggregate
            .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal('100000.00') } })
            .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal('49500000.00') } });

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        '600000.00',
                reference:     'ref-monthly-limit',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('Monthly transfer limit exceeded'),
        });
    });

    it('handles multiple transfers contributing to daily/monthly totals correctly', async () => {
        const sender = makeSenderAccount({ balance: new Prisma.Decimal('10000000.00') });
        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.transaction.aggregate
            .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal('4000000.00') } })
            .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal('10000000.00') } });

        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 1 });
        const record = makeTransactionRecord({ amount: new Prisma.Decimal('1000000.00') });
        prismaMock.transaction.create.mockResolvedValue(record);

        const result = await TransactionService.transferMoney('user-1', {
            fromAccountId: 'acc-sender',
            toAccountId:   'acc-receiver',
            amount:        '1000000.00',
            reference:     'ref-multi-limit',
        });

        expect(result).toEqual(record);
    });

    it('maintains exact Decimal precision during limit checks', async () => {
        const sender = makeSenderAccount({ balance: new Prisma.Decimal('10000000.00') });
        prismaMock.account.findFirst.mockResolvedValue(sender);

        prismaMock.transaction.aggregate
            .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal('4999999.99') } })
            .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal('4999999.99') } });

        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 1 });
        const record = makeTransactionRecord({ amount: new Prisma.Decimal('0.01') });
        prismaMock.transaction.create.mockResolvedValue(record);

        const result = await TransactionService.transferMoney('user-1', {
            fromAccountId: 'acc-sender',
            toAccountId:   'acc-receiver',
            amount:        '0.01',
            reference:     'ref-prec-limit',
        });

        expect(result).toEqual(record);
    });

    it('filters aggregate queries to only count COMPLETED TRANSFER transactions', async () => {
        const sender = makeSenderAccount();
        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: null } });

        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 1 });
        const record = makeTransactionRecord({ amount: new Prisma.Decimal('100.00') });
        prismaMock.transaction.create.mockResolvedValue(record);

        await TransactionService.transferMoney('user-1', {
            fromAccountId: 'acc-sender',
            toAccountId:   'acc-receiver',
            amount:        '100.00',
            reference:     'ref-filter-check',
        });

        expect(prismaMock.transaction.aggregate).toHaveBeenNthCalledWith(1, expect.objectContaining({
            where: expect.objectContaining({
                fromAccountId: 'acc-sender',
                type: 'TRANSFER',
                status: 'COMPLETED',
            })
        }));
    });
});

// ---------------------------------------------------------------------------
// Account Status & Receiver Validation (Phase 4)
// ---------------------------------------------------------------------------

describe('TransactionService.transferMoney - Receiver & Account Status Validation', () => {

    it('rejects when receiver account does not exist', async () => {
        const sender = makeSenderAccount();
        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.account.findUnique.mockResolvedValue(null);

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-nonexistent',
                amount:        '100.00',
                reference:     'ref-rec-notfound',
            })
        ).rejects.toMatchObject({
            statusCode: 404,
            message: expect.stringContaining('Receiver account not found'),
        });

        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('succeeds when receiver belongs to another user and is ACTIVE', async () => {
        const sender = makeSenderAccount({ userId: 'user-1' });
        const receiver = makeReceiverAccount({ userId: 'user-2', status: 'ACTIVE' });
        const record = makeTransactionRecord();

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.account.findUnique.mockResolvedValue(receiver);
        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 1 });
        prismaMock.transaction.create.mockResolvedValue(record);

        const result = await TransactionService.transferMoney('user-1', {
            fromAccountId: 'acc-sender',
            toAccountId:   'acc-receiver',
            amount:        '100.00',
            reference:     'ref-cross-user-ok',
        });

        expect(result).toEqual(record);
    });

    it('rejects transfer when receiver is INACTIVE', async () => {
        const sender = makeSenderAccount();
        const receiver = makeReceiverAccount({ status: 'INACTIVE' as any });

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.account.findUnique.mockResolvedValue(receiver);

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        '100.00',
                reference:     'ref-rec-inactive',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('Receiver account is inactive'),
        });

        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects transfer when receiver is CLOSED', async () => {
        const sender = makeSenderAccount();
        const receiver = makeReceiverAccount({ status: 'CLOSED' as any });

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.account.findUnique.mockResolvedValue(receiver);

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        '100.00',
                reference:     'ref-rec-closed',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('Receiver account is closed'),
        });

        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects transfer when receiver is BLOCKED', async () => {
        const sender = makeSenderAccount();
        const receiver = makeReceiverAccount({ status: 'BLOCKED' as any });

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.account.findUnique.mockResolvedValue(receiver);

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        '100.00',
                reference:     'ref-rec-blocked',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('Receiver account is blocked'),
        });

        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects transfer when receiver is FROZEN', async () => {
        const sender = makeSenderAccount();
        const receiver = makeReceiverAccount({ status: 'FROZEN' as any });

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.account.findUnique.mockResolvedValue(receiver);

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        '100.00',
                reference:     'ref-rec-frozen',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('Receiver account is frozen'),
        });

        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects transfer when receiver is SUSPENDED', async () => {
        const sender = makeSenderAccount();
        const receiver = makeReceiverAccount({ status: 'SUSPENDED' as any });

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.account.findUnique.mockResolvedValue(receiver);

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        '100.00',
                reference:     'ref-rec-suspended',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('Receiver account is suspended'),
        });

        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects transfer when sender account is CLOSED', async () => {
        const sender = makeSenderAccount({ status: 'CLOSED' as any });
        const receiver = makeReceiverAccount();

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.account.findUnique.mockResolvedValue(receiver);

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        '100.00',
                reference:     'ref-sender-closed',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('Sender account is closed'),
        });

        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects transfer when sender account is BLOCKED', async () => {
        const sender = makeSenderAccount({ status: 'BLOCKED' as any });
        const receiver = makeReceiverAccount();

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.account.findUnique.mockResolvedValue(receiver);

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        '100.00',
                reference:     'ref-sender-blocked',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('Sender account is blocked'),
        });

        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects transfer when sender account is FROZEN', async () => {
        const sender = makeSenderAccount({ status: 'FROZEN' as any });
        const receiver = makeReceiverAccount();

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.account.findUnique.mockResolvedValue(receiver);

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        '100.00',
                reference:     'ref-sender-frozen',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('Sender account is frozen'),
        });

        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects transfer when sender account is SUSPENDED', async () => {
        const sender = makeSenderAccount({ status: 'SUSPENDED' as any });
        const receiver = makeReceiverAccount();

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.account.findUnique.mockResolvedValue(receiver);

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        '100.00',
                reference:     'ref-sender-suspended',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('Sender account is suspended'),
        });

        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects transfer when sender account is INACTIVE', async () => {
        const sender = makeSenderAccount({ status: 'INACTIVE' as any });
        const receiver = makeReceiverAccount();

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.account.findUnique.mockResolvedValue(receiver);

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        '100.00',
                reference:     'ref-sender-inactive',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('Sender account is inactive'),
        });

        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects transfer when there is a currency mismatch between sender and receiver', async () => {
        const sender = makeSenderAccount({ currency: 'INR' });
        const receiver = makeReceiverAccount({ currency: 'USD' });

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.account.findUnique.mockResolvedValue(receiver);

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        '100.00',
                reference:     'ref-curr-mismatch',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('Currency mismatch'),
        });

        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('ensures insufficient-funds behavior remains intact', async () => {
        const sender = makeSenderAccount();
        const receiver = makeReceiverAccount();

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.account.findUnique.mockResolvedValue(receiver);
        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany.mockResolvedValueOnce({ count: 0 });

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        '99999.00',
                reference:     'ref-insufficient-funds-intact',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('Insufficient funds'),
        });
    });
});

// ---------------------------------------------------------------------------
// TransactionService.depositMoney
// ---------------------------------------------------------------------------

describe('TransactionService.depositMoney', () => {
    it('deposits funds successfully with a valid Decimal string', async () => {
        const sender = makeSenderAccount();
        const record = makeTransactionRecord({
            type: 'DEPOSIT',
            amount: new Prisma.Decimal('250.75'),
            fromAccountId: null,
            toAccountId: 'acc-sender',
        });

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany.mockResolvedValueOnce({ count: 1 });
        prismaMock.transaction.create.mockResolvedValue(record);

        const result = await TransactionService.depositMoney('user-1', {
            accountId: 'acc-sender',
            amount: '250.75',
            reference: 'ref-dep-1',
        });

        expect(result).toEqual(record);
        expect(prismaMock.transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    type: 'DEPOSIT',
                    amount: new Prisma.Decimal('250.75'),
                })
            })
        );
    });

    it('rejects deposit when amount is zero or negative', async () => {
        await expect(
            TransactionService.depositMoney('user-1', {
                accountId: 'acc-sender',
                amount: '0.00',
                reference: 'ref-dep-zero',
            })
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('rejects deposit when account is not found or unauthorized', async () => {
        prismaMock.account.findFirst.mockResolvedValue(null);

        await expect(
            TransactionService.depositMoney('user-1', {
                accountId: 'acc-invalid',
                amount: '100.00',
                reference: 'ref-dep-notfound',
            })
        ).rejects.toMatchObject({ statusCode: 404 });
    });
});

// ---------------------------------------------------------------------------
// TransactionService.withdrawMoney
// ---------------------------------------------------------------------------

describe('TransactionService.withdrawMoney', () => {
    it('withdraws funds successfully with a valid Decimal string', async () => {
        const sender = makeSenderAccount();
        const record = makeTransactionRecord({
            type: 'WITHDRAWAL',
            amount: new Prisma.Decimal('50.25'),
            fromAccountId: 'acc-sender',
            toAccountId: null,
        });

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany.mockResolvedValueOnce({ count: 1 });
        prismaMock.transaction.create.mockResolvedValue(record);

        const result = await TransactionService.withdrawMoney('user-1', {
            accountId: 'acc-sender',
            amount: '50.25',
            reference: 'ref-wth-1',
        });

        expect(result).toEqual(record);
        expect(prismaMock.transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    type: 'WITHDRAWAL',
                    amount: new Prisma.Decimal('50.25'),
                })
            })
        );
    });

    it('rejects withdrawal when insufficient funds exist', async () => {
        const sender = makeSenderAccount();

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany.mockResolvedValueOnce({ count: 0 });

        await expect(
            TransactionService.withdrawMoney('user-1', {
                accountId: 'acc-sender',
                amount: '99999.00',
                reference: 'ref-wth-nofunds',
            })
        ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Insufficient') });
    });

    it('rejects withdrawal when amount is zero or negative', async () => {
        await expect(
            TransactionService.withdrawMoney('user-1', {
                accountId: 'acc-sender',
                amount: '-10.00',
                reference: 'ref-wth-neg',
            })
        ).rejects.toMatchObject({ statusCode: 400 });
    });
});

// ---------------------------------------------------------------------------
// Transaction Validation Schema Tests (Zod)
// ---------------------------------------------------------------------------

describe('transferSchema Zod Validation', () => {
    it('accepts valid monetary decimal strings', async () => {
        const validBody = {
            fromAccountId: '123e4567-e89b-12d3-a456-426614174000',
            toAccountId:   '123e4567-e89b-12d3-a456-426614174001',
            amount:        '100.50',
            reference:     '123e4567-e89b-12d3-a456-426614174002',
        };

        const result = await transferSchema.parseAsync({ body: validBody });
        expect(result.body.amount).toBe('100.50');
    });

    it('accepts boundary decimal values like 0.01 and 4 decimal places within limits', async () => {
        const validBody = {
            fromAccountId: '123e4567-e89b-12d3-a456-426614174000',
            toAccountId:   '123e4567-e89b-12d3-a456-426614174001',
            amount:        '0.0100',
            reference:     '123e4567-e89b-12d3-a456-426614174002',
        };

        const result = await transferSchema.parseAsync({ body: validBody });
        expect(result.body.amount).toBe('0.0100');
    });

    it('rejects numbers passed as amount instead of decimal string', async () => {
        const invalidBody = {
            fromAccountId: '123e4567-e89b-12d3-a456-426614174000',
            toAccountId:   '123e4567-e89b-12d3-a456-426614174001',
            amount:        100.50, // Number input should be rejected
            reference:     '123e4567-e89b-12d3-a456-426614174002',
        };

        await expect(transferSchema.parseAsync({ body: invalidBody })).rejects.toThrow();
    });

    it('rejects invalid decimal strings, negative values, zero, amounts below min (0.01), amounts above max (1,000,000), and more than 4 decimal places', async () => {
        const testCases = ['abc', '-50.00', '0.00', '0.005', '1000000.01', '100.12345', '100.0.0'];

        for (const badAmount of testCases) {
            const invalidBody = {
                fromAccountId: '123e4567-e89b-12d3-a456-426614174000',
                toAccountId:   '123e4567-e89b-12d3-a456-426614174001',
                amount:        badAmount,
                reference:     '123e4567-e89b-12d3-a456-426614174002',
            };

            await expect(transferSchema.parseAsync({ body: invalidBody })).rejects.toThrow();
        }
    });
});

// ---------------------------------------------------------------------------
// TransactionService.getTransactionHistory
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

// ---------------------------------------------------------------------------
// Phase 6 — Before/After Balances & Transaction Status
// ---------------------------------------------------------------------------

describe('Phase 6 — Before/After Balances & Transaction Status', () => {
    it('captures accurate transfer sender before/after balances using Decimal arithmetic', async () => {
        const sender = makeSenderAccount({ balance: new Prisma.Decimal('5000.0000') });
        const receiver = makeReceiverAccount({ balance: new Prisma.Decimal('1000.0000') });

        prismaMock.account.findFirst.mockResolvedValue(sender);
        // Pre-tx findUnique for receiver check
        prismaMock.account.findUnique
            // 1st: pre-tx receiver validation
            .mockResolvedValueOnce(receiver)
            // 2nd: in-tx sender balance read (after decrement)
            .mockResolvedValueOnce({ ...sender, balance: new Prisma.Decimal('3499.5000') })
            // 3rd: in-tx receiver balance read (after increment)
            .mockResolvedValueOnce({ ...receiver, balance: new Prisma.Decimal('2500.5000') });

        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany.mockResolvedValue({ count: 1 });
        prismaMock.transaction.create.mockResolvedValue(makeTransactionRecord());

        await TransactionService.transferMoney('user-1', {
            fromAccountId: 'acc-sender',
            toAccountId:   'acc-receiver',
            amount:        '1500.5000',
            reference:     'ref-bal-sender',
        });

        expect(prismaMock.transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    type: 'TRANSFER',
                    status: 'COMPLETED',
                    amount: new Prisma.Decimal('1500.5000'),
                    senderBalanceBefore: new Prisma.Decimal('5000.0000'),
                    senderBalanceAfter:  new Prisma.Decimal('3499.5000'),
                })
            })
        );
    });

    it('captures accurate transfer receiver before/after balances using Decimal arithmetic', async () => {
        const sender = makeSenderAccount({ balance: new Prisma.Decimal('5000.0000') });
        const receiver = makeReceiverAccount({ balance: new Prisma.Decimal('1000.0000') });

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.account.findUnique
            .mockResolvedValueOnce(receiver)
            .mockResolvedValueOnce({ ...sender, balance: new Prisma.Decimal('3499.5000') })
            .mockResolvedValueOnce({ ...receiver, balance: new Prisma.Decimal('2500.5000') });

        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany.mockResolvedValue({ count: 1 });
        prismaMock.transaction.create.mockResolvedValue(makeTransactionRecord());

        await TransactionService.transferMoney('user-1', {
            fromAccountId: 'acc-sender',
            toAccountId:   'acc-receiver',
            amount:        '1500.5000',
            reference:     'ref-bal-receiver',
        });

        expect(prismaMock.transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    type: 'TRANSFER',
                    status: 'COMPLETED',
                    receiverBalanceBefore: new Prisma.Decimal('1000.0000'),
                    receiverBalanceAfter:  new Prisma.Decimal('2500.5000'),
                })
            })
        );
    });

    it('captures accurate deposit before/after balances on receiver fields (sender fields null)', async () => {
        const account = makeSenderAccount({ balance: new Prisma.Decimal('200.0000') });

        prismaMock.account.findFirst.mockResolvedValue(account);
        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany.mockResolvedValueOnce({ count: 1 });
        prismaMock.account.findUnique.mockResolvedValueOnce({
            ...account,
            balance: new Prisma.Decimal('500.2500'),
        });
        prismaMock.transaction.create.mockResolvedValue(makeTransactionRecord());

        await TransactionService.depositMoney('user-1', {
            accountId: 'acc-sender',
            amount: '300.2500',
            reference: 'ref-bal-dep',
        });

        expect(prismaMock.transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    type: 'DEPOSIT',
                    status: 'COMPLETED',
                    senderBalanceBefore: null,
                    senderBalanceAfter:  null,
                    receiverBalanceBefore: new Prisma.Decimal('200.0000'),
                    receiverBalanceAfter:  new Prisma.Decimal('500.2500'),
                })
            })
        );
    });

    it('captures accurate withdrawal before/after balances on sender fields (receiver fields null)', async () => {
        const account = makeSenderAccount({ balance: new Prisma.Decimal('1000.0000') });

        prismaMock.account.findFirst.mockResolvedValue(account);
        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany.mockResolvedValueOnce({ count: 1 });
        prismaMock.account.findUnique.mockResolvedValueOnce({
            ...account,
            balance: new Prisma.Decimal('749.2500'),
        });
        prismaMock.transaction.create.mockResolvedValue(makeTransactionRecord());

        await TransactionService.withdrawMoney('user-1', {
            accountId: 'acc-sender',
            amount: '250.7500',
            reference: 'ref-bal-with',
        });

        expect(prismaMock.transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    type: 'WITHDRAWAL',
                    status: 'COMPLETED',
                    senderBalanceBefore: new Prisma.Decimal('1000.0000'),
                    senderBalanceAfter:  new Prisma.Decimal('749.2500'),
                    receiverBalanceBefore: null,
                    receiverBalanceAfter:  null,
                })
            })
        );
    });

    it('preserves Decimal precision to 4 decimal places without floating-point errors', async () => {
        // Test classic float issue: 0.1 + 0.2 === 0.30000000000000004
        const sender = makeSenderAccount({ balance: new Prisma.Decimal('10.3000') });
        const receiver = makeReceiverAccount({ balance: new Prisma.Decimal('0.1000') });

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.account.findUnique
            .mockResolvedValueOnce(receiver)
            .mockResolvedValueOnce({ ...sender, balance: new Prisma.Decimal('10.1000') })
            .mockResolvedValueOnce({ ...receiver, balance: new Prisma.Decimal('0.3000') });

        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany.mockResolvedValue({ count: 1 });
        prismaMock.transaction.create.mockResolvedValue(makeTransactionRecord());

        await TransactionService.transferMoney('user-1', {
            fromAccountId: 'acc-sender',
            toAccountId:   'acc-receiver',
            amount:        '0.2000',
            reference:     'ref-bal-precision',
        });

        expect(prismaMock.transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    senderBalanceBefore:   new Prisma.Decimal('10.3000'),
                    senderBalanceAfter:    new Prisma.Decimal('10.1000'),
                    receiverBalanceBefore: new Prisma.Decimal('0.1000'),
                    receiverBalanceAfter:  new Prisma.Decimal('0.3000'),
                })
            })
        );
    });

    it('ensures insufficient funds leaves balances unchanged and aborts transfer', async () => {
        const sender = makeSenderAccount({ balance: new Prisma.Decimal('50.0000') });
        const receiver = makeReceiverAccount();

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.account.findUnique.mockResolvedValue(receiver);
        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany.mockResolvedValueOnce({ count: 0 }); // Sender update fails
        prismaMock.transaction.create.mockResolvedValue(makeTransactionRecord());

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        '100.00',
                reference:     'ref-insufficient-fail',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: 'Insufficient funds',
        });

        // Inside tx, transaction.create with status COMPLETED was never called
        expect(prismaMock.transaction.create).not.toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: 'COMPLETED',
                })
            })
        );
    });

    it('records a FAILED transaction snapshot with null balances on genuine transaction failure', async () => {
        const sender = makeSenderAccount();
        const receiver = makeReceiverAccount();

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.account.findUnique.mockResolvedValue(receiver);
        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany.mockResolvedValueOnce({ count: 0 }); // Insufficient funds in tx

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        '500.00',
                reference:     'ref-failed-snapshot',
            })
        ).rejects.toThrow();

        // FAILED record created outside the aborted tx
        expect(prismaMock.transaction.create).toHaveBeenCalledWith({
            data: {
                reference: 'ref-failed-snapshot',
                amount: new Prisma.Decimal('500.00'),
                type: 'TRANSFER',
                status: 'FAILED',
                description: 'Insufficient funds',
                fromAccountId: 'acc-sender',
                toAccountId: 'acc-receiver',
                senderBalanceBefore: null,
                senderBalanceAfter:  null,
                receiverBalanceBefore: null,
                receiverBalanceAfter:  null,
            }
        });
    });

    it('ensures rollback leaves no successful transaction record and failure-audit write does not alter error', async () => {
        const sender = makeSenderAccount();
        const receiver = makeReceiverAccount();

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.account.findUnique.mockResolvedValue(receiver);
        // Simulate DB transaction throwing an error
        prismaMock.$transaction.mockRejectedValueOnce(new Error('DB deadlock detected'));
        // Even if creating the FAILED record also encounters an error
        prismaMock.transaction.create.mockRejectedValueOnce(new Error('Audit write DB down'));

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                toAccountId:   'acc-receiver',
                amount:        '100.00',
                reference:     'ref-rollback-resilient',
            })
        ).rejects.toThrow('DB deadlock detected'); // Original error must be preserved
    });
});

// ---------------------------------------------------------------------------
// Phase 7: Transfer by Account Number
// ---------------------------------------------------------------------------

describe('Phase 7: Transfer by Account Number', () => {
    // Helper: set up a "happy path" $transaction mock that succeeds
    const makeSuccessfulTxMock = (sender = makeSenderAccount(), receiver = makeReceiverAccount(), record = makeTransactionRecord()) => {
        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany
            .mockResolvedValueOnce({ count: 1 }) // sender decrement
            .mockResolvedValueOnce({ count: 1 }); // receiver increment
        prismaMock.transaction.create.mockResolvedValue(record);
        return record;
    };

    it('resolves toAccountNumber to UUID and completes transfer', async () => {
        const sender = makeSenderAccount();
        const receiver = makeReceiverAccount();  // id: 'acc-receiver'
        const record = makeTransactionRecord();

        // findUnique call order:
        // 1. accountNumber resolution → returns receiver
        // 2. Phase 4 status check (by id) → returns receiver
        // 3. Inside $tx: sender balance snapshot → returns sender (via findUnique)
        // 4. Inside $tx: receiver balance snapshot → returns receiver
        prismaMock.account.findUnique
            .mockResolvedValueOnce(receiver)   // 1. resolution
            .mockResolvedValueOnce(receiver)   // 2. Phase 4 check
            .mockResolvedValueOnce(sender)     // 3. sender snapshot inside tx
            .mockResolvedValueOnce(receiver);  // 4. receiver snapshot inside tx

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 1 });
        prismaMock.transaction.create.mockResolvedValue(record);

        const result = await TransactionService.transferMoney('user-1', {
            fromAccountId:   'acc-sender',
            toAccountNumber: '2222222222',
            amount:          '100.00',
            reference:       'ref-p7-accnum-ok',
        });

        expect(result).toEqual(record);
        // Resolution lookup was by accountNumber
        expect(prismaMock.account.findUnique).toHaveBeenCalledWith({ where: { accountNumber: '2222222222' } });
        // Transaction record must use the resolved UUID, not the account number
        expect(prismaMock.transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    toAccountId: 'acc-receiver',
                    status: 'COMPLETED',
                })
            })
        );
    });

    it('backward compat: transfer via toAccountId (UUID) still works', async () => {
        const sender = makeSenderAccount();
        const receiver = makeReceiverAccount();
        const record = makeTransactionRecord();

        prismaMock.account.findFirst.mockResolvedValue(sender);
        // findUnique sequence: Phase 4 check, then sender snapshot, then receiver snapshot
        prismaMock.account.findUnique
            .mockResolvedValueOnce(receiver)  // Phase 4 receiver status check
            .mockResolvedValueOnce(sender)    // sender balance snapshot inside tx
            .mockResolvedValueOnce(receiver); // receiver balance snapshot inside tx

        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 1 });
        prismaMock.transaction.create.mockResolvedValue(record);

        const result = await TransactionService.transferMoney('user-1', {
            fromAccountId: 'acc-sender',
            toAccountId:   'acc-receiver',
            amount:        '100.00',
            reference:     'ref-p7-compat-id',
        });

        expect(result).toEqual(record);
        // No accountNumber resolution call: findUnique should NOT have been called with accountNumber
        const findUniqueCalls = prismaMock.account.findUnique.mock.calls;
        const resolutionCall = findUniqueCalls.find((args: any[]) => args[0]?.where?.accountNumber !== undefined);
        expect(resolutionCall).toBeUndefined();
    });

    it('rejects when neither toAccountId nor toAccountNumber is provided', async () => {
        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId: 'acc-sender',
                // neither toAccountId nor toAccountNumber
                amount:        '100.00',
                reference:     'ref-p7-neither',
            } as any)
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('toAccountNumber or toAccountId is required'),
        });

        // No DB calls should have been made
        expect(prismaMock.account.findUnique).not.toHaveBeenCalled();
    });

    it('rejects with 404 when toAccountNumber does not exist in the database', async () => {
        // Resolution returns null → account not found
        prismaMock.account.findUnique.mockResolvedValueOnce(null);

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId:   'acc-sender',
                toAccountNumber: '9999999999',
                amount:          '100.00',
                reference:       'ref-p7-no-accnum',
            })
        ).rejects.toMatchObject({
            statusCode: 404,
            message: expect.stringContaining('Receiver account not found'),
        });

        // Resolution was attempted; no further DB calls
        expect(prismaMock.account.findUnique).toHaveBeenCalledOnce();
        expect(prismaMock.account.findFirst).not.toHaveBeenCalled();
    });

    it('rejects with 400 when receiver found by account number is INACTIVE', async () => {
        const inactiveReceiver = makeReceiverAccount({ status: 'INACTIVE' as any });

        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());
        // findUnique calls:
        // 1. accountNumber resolution → inactiveReceiver
        // 2. Phase 4 receiver status check by id → inactiveReceiver
        prismaMock.account.findUnique
            .mockResolvedValueOnce(inactiveReceiver)   // resolution
            .mockResolvedValueOnce(inactiveReceiver);  // Phase 4 check

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId:   'acc-sender',
                toAccountNumber: '3333333333',
                amount:          '100.00',
                reference:       'ref-p7-inactive',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('inactive'),
        });

        // No transaction was created
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects with 400 when receiver found by account number is BLOCKED', async () => {
        const blockedReceiver = makeReceiverAccount({ status: 'BLOCKED' as any });

        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());
        prismaMock.account.findUnique
            .mockResolvedValueOnce(blockedReceiver)   // resolution
            .mockResolvedValueOnce(blockedReceiver);  // Phase 4 check

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId:   'acc-sender',
                toAccountNumber: '3333333333',
                amount:          '100.00',
                reference:       'ref-p7-blocked',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('blocked'),
        });
    });

    it('rejects with 400 when receiver found by account number is CLOSED', async () => {
        const closedReceiver = makeReceiverAccount({ status: 'CLOSED' as any });

        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());
        prismaMock.account.findUnique
            .mockResolvedValueOnce(closedReceiver)   // resolution
            .mockResolvedValueOnce(closedReceiver);  // Phase 4 check

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId:   'acc-sender',
                toAccountNumber: '3333333333',
                amount:          '100.00',
                reference:       'ref-p7-closed',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('closed'),
        });
    });

    it('rejects with 400 on currency mismatch when receiver found by account number', async () => {
        const sender   = makeSenderAccount({ currency: 'INR' });
        const receiver = makeReceiverAccount({ currency: 'USD' });

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.account.findUnique
            .mockResolvedValueOnce(receiver)   // resolution
            .mockResolvedValueOnce(receiver);  // Phase 4 check

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId:   'acc-sender',
                toAccountNumber: '2222222222',
                amount:          '100.00',
                reference:       'ref-p7-currency',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('Currency mismatch'),
        });
    });

    it('rejects with 400 when toAccountNumber resolves to the sender\'s own account', async () => {
        // Sender and "receiver" are the same account
        const account = makeSenderAccount({ id: 'acc-sender', accountNumber: '1111111111' });

        // Resolution returns the same account as sender
        prismaMock.account.findUnique.mockResolvedValueOnce(account);

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId:   'acc-sender',
                toAccountNumber: '1111111111',
                amount:          '100.00',
                reference:       'ref-p7-selfxfer',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('same account'),
        });

        // Self-transfer guard fires before sender lookup
        expect(prismaMock.account.findFirst).not.toHaveBeenCalled();
    });

    it('transaction record uses resolved UUID (not account number) for toAccountId', async () => {
        const sender   = makeSenderAccount();
        const receiver = makeReceiverAccount({ id: 'acc-receiver-uuid', accountNumber: '5555555555' });
        const record   = makeTransactionRecord({ toAccountId: 'acc-receiver-uuid' });

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.account.findUnique
            .mockResolvedValueOnce(receiver)   // resolution
            .mockResolvedValueOnce(receiver)   // Phase 4 check
            .mockResolvedValueOnce(sender)     // sender snapshot inside tx
            .mockResolvedValueOnce(receiver);  // receiver snapshot inside tx

        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        prismaMock.account.updateMany
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 1 });
        prismaMock.transaction.create.mockResolvedValue(record);

        await TransactionService.transferMoney('user-1', {
            fromAccountId:   'acc-sender',
            toAccountNumber: '5555555555',
            amount:          '100.00',
            reference:       'ref-p7-uuid-in-record',
        });

        // The transaction record must reference the UUID, not the account number string
        expect(prismaMock.transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ toAccountId: 'acc-receiver-uuid' })
            })
        );
        // The account number string must NOT appear in any create call data
        const createCallData = prismaMock.transaction.create.mock.calls[0]?.[0]?.data;
        expect(Object.values(createCallData ?? {})).not.toContain('5555555555');
    });

    it('insufficient funds via toAccountNumber path rejects correctly', async () => {
        const sender   = makeSenderAccount({ balance: new Prisma.Decimal('50.00') });
        const receiver = makeReceiverAccount();

        prismaMock.account.findFirst.mockResolvedValue(sender);
        prismaMock.account.findUnique
            .mockResolvedValueOnce(receiver)   // resolution
            .mockResolvedValueOnce(receiver);  // Phase 4 check

        prismaMock.$transaction.mockImplementation(async (fn: Function) => fn(prismaMock));
        // Sender updateMany returns 0 (balance check failed)
        prismaMock.account.updateMany.mockResolvedValueOnce({ count: 0 });
        // findUnique inside tx for disambiguation (sender)
        prismaMock.account.findUnique.mockResolvedValueOnce(sender);

        await expect(
            TransactionService.transferMoney('user-1', {
                fromAccountId:   'acc-sender',
                toAccountNumber: '2222222222',
                amount:          '999.00',
                reference:       'ref-p7-nofunds',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('Insufficient'),
        });
    });

    it('transferSchema: Zod rejects when neither toAccountId nor toAccountNumber provided', () => {
        const result = transferSchema.safeParse({
            body: {
                fromAccountId: '550e8400-e29b-41d4-a716-446655440000',
                amount:        '100.00',
                reference:     '550e8400-e29b-41d4-a716-446655440001',
            }
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map(i => i.message);
            expect(messages).toContain('Either toAccountNumber or toAccountId is required');
        }
    });

    it('transferSchema: Zod rejects when both toAccountId and toAccountNumber provided', () => {
        const result = transferSchema.safeParse({
            body: {
                fromAccountId:   '550e8400-e29b-41d4-a716-446655440000',
                toAccountId:     '550e8400-e29b-41d4-a716-446655440002',
                toAccountNumber: '1234567890',
                amount:          '100.00',
                reference:       '550e8400-e29b-41d4-a716-446655440001',
            }
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map(i => i.message);
            expect(messages).toContain('Provide only one of toAccountNumber or toAccountId, not both');
        }
    });

    it('transferSchema: Zod accepts toAccountNumber alone (10 digits)', () => {
        const result = transferSchema.safeParse({
            body: {
                fromAccountId:   '550e8400-e29b-41d4-a716-446655440000',
                toAccountNumber: '1234567890',
                amount:          '100.00',
                reference:       '550e8400-e29b-41d4-a716-446655440001',
            }
        });
        expect(result.success).toBe(true);
    });

    it('transferSchema: Zod accepts toAccountId alone (UUID)', () => {
        const result = transferSchema.safeParse({
            body: {
                fromAccountId: '550e8400-e29b-41d4-a716-446655440000',
                toAccountId:   '550e8400-e29b-41d4-a716-446655440002',
                amount:        '100.00',
                reference:     '550e8400-e29b-41d4-a716-446655440001',
            }
        });
        expect(result.success).toBe(true);
    });

    it('transferSchema: Zod rejects toAccountNumber that is not 10 digits', () => {
        const tooShort = transferSchema.safeParse({
            body: {
                fromAccountId:   '550e8400-e29b-41d4-a716-446655440000',
                toAccountNumber: '123456789', // 9 digits
                amount:          '100.00',
                reference:       '550e8400-e29b-41d4-a716-446655440001',
            }
        });
        expect(tooShort.success).toBe(false);

        const hasLetters = transferSchema.safeParse({
            body: {
                fromAccountId:   '550e8400-e29b-41d4-a716-446655440000',
                toAccountNumber: 'ABC1234567',
                amount:          '100.00',
                reference:       '550e8400-e29b-41d4-a716-446655440001',
            }
        });
        expect(hasLetters.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Phase 8: Transaction Filtering
// ---------------------------------------------------------------------------

describe('Phase 8: Transaction Filtering', () => {
    it('rejects history request when account does not belong to user (ownership protection)', async () => {
        prismaMock.account.findFirst.mockResolvedValue(null);

        await expect(
            TransactionService.getTransactionHistory('user-1', 'acc-other', 10)
        ).rejects.toMatchObject({
            statusCode: 404,
            message: expect.stringContaining('Account not found or unauthorized'),
        });

        expect(prismaMock.transaction.findMany).not.toHaveBeenCalled();
    });

    it('filters by date-only startDate using start of calendar day (00:00:00.000Z)', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());
        prismaMock.transaction.findMany.mockResolvedValue([]);

        await TransactionService.getTransactionHistory('user-1', 'acc-sender', 10, undefined, {
            startDate: '2026-05-10',
        });

        expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    AND: expect.arrayContaining([
                        { createdAt: { gte: new Date('2026-05-10T00:00:00.000Z') } },
                    ]),
                }),
            })
        );
    });

    it('filters by date-only endDate using end of calendar day (23:59:59.999Z)', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());
        prismaMock.transaction.findMany.mockResolvedValue([]);

        await TransactionService.getTransactionHistory('user-1', 'acc-sender', 10, undefined, {
            endDate: '2026-05-10',
        });

        expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    AND: expect.arrayContaining([
                        { createdAt: { lte: new Date('2026-05-10T23:59:59.999Z') } },
                    ]),
                }),
            })
        );
    });

    it('preserves explicit timestamp and timezone semantics for date filters', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());
        prismaMock.transaction.findMany.mockResolvedValue([]);

        const startTime = '2026-05-10T14:30:00.000Z';
        const endTime = '2026-05-10T18:45:00.000Z';

        await TransactionService.getTransactionHistory('user-1', 'acc-sender', 10, undefined, {
            startDate: startTime,
            endDate: endTime,
        });

        expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    AND: expect.arrayContaining([
                        {
                            createdAt: {
                                gte: new Date(startTime),
                                lte: new Date(endTime),
                            },
                        },
                    ]),
                }),
            })
        );
    });

    it('accepts equal startDate and endDate as a valid date boundary', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());
        prismaMock.transaction.findMany.mockResolvedValue([]);

        // Date-only equality (same calendar day)
        await expect(
            TransactionService.getTransactionHistory('user-1', 'acc-sender', 10, undefined, {
                startDate: '2026-05-10',
                endDate: '2026-05-10',
            })
        ).resolves.not.toThrow();

        // Exact timestamp equality
        await expect(
            TransactionService.getTransactionHistory('user-1', 'acc-sender', 10, undefined, {
                startDate: '2026-05-10T12:00:00.000Z',
                endDate: '2026-05-10T12:00:00.000Z',
            })
        ).resolves.not.toThrow();
    });

    it('rejects when startDate is after endDate', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());

        await expect(
            TransactionService.getTransactionHistory('user-1', 'acc-sender', 10, undefined, {
                startDate: '2026-05-11',
                endDate: '2026-05-10',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('startDate cannot be after endDate'),
        });
    });

    it('rejects invalid date formats', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());

        await expect(
            TransactionService.getTransactionHistory('user-1', 'acc-sender', 10, undefined, {
                startDate: 'not-a-date',
            })
        ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Invalid startDate') });

        await expect(
            TransactionService.getTransactionHistory('user-1', 'acc-sender', 10, undefined, {
                endDate: 'not-a-date',
            })
        ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Invalid endDate') });
    });

    it('filters by status (COMPLETED, FAILED, PENDING, REVERSED)', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());
        prismaMock.transaction.findMany.mockResolvedValue([]);

        await TransactionService.getTransactionHistory('user-1', 'acc-sender', 10, undefined, {
            status: 'COMPLETED',
        });

        expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    AND: expect.arrayContaining([{ status: 'COMPLETED' }]),
                }),
            })
        );
    });

    it('rejects invalid status enum', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());

        await expect(
            TransactionService.getTransactionHistory('user-1', 'acc-sender', 10, undefined, {
                status: 'INVALID_STATUS' as any,
            })
        ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Invalid transaction status') });
    });

    it('filters by type (DEPOSIT, WITHDRAWAL, TRANSFER)', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());
        prismaMock.transaction.findMany.mockResolvedValue([]);

        await TransactionService.getTransactionHistory('user-1', 'acc-sender', 10, undefined, {
            type: 'TRANSFER',
        });

        expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    AND: expect.arrayContaining([{ type: 'TRANSFER' }]),
                }),
            })
        );
    });

    it('rejects invalid type enum', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());

        await expect(
            TransactionService.getTransactionHistory('user-1', 'acc-sender', 10, undefined, {
                type: 'INVALID_TYPE' as any,
            })
        ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Invalid transaction type') });
    });

    it('filters by minAmount and maxAmount using Decimal comparisons', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());
        prismaMock.transaction.findMany.mockResolvedValue([]);

        await TransactionService.getTransactionHistory('user-1', 'acc-sender', 10, undefined, {
            minAmount: '100.5000',
            maxAmount: '500.7500',
        });

        expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    AND: expect.arrayContaining([
                        {
                            amount: {
                                gte: new Prisma.Decimal('100.5000'),
                                lte: new Prisma.Decimal('500.7500'),
                            },
                        },
                    ]),
                }),
            })
        );
    });

    it('accepts equal minAmount and maxAmount as a valid amount boundary', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());
        prismaMock.transaction.findMany.mockResolvedValue([]);

        await expect(
            TransactionService.getTransactionHistory('user-1', 'acc-sender', 10, undefined, {
                minAmount: '100.00',
                maxAmount: '100.00',
            })
        ).resolves.not.toThrow();
    });

    it('accepts zero minAmount (0.00) as boundary', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());
        prismaMock.transaction.findMany.mockResolvedValue([]);

        await expect(
            TransactionService.getTransactionHistory('user-1', 'acc-sender', 10, undefined, {
                minAmount: '0.00',
            })
        ).resolves.not.toThrow();
    });

    it('preserves Decimal precision to 4 decimal places during monetary filtering', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());
        prismaMock.transaction.findMany.mockResolvedValue([]);

        await TransactionService.getTransactionHistory('user-1', 'acc-sender', 10, undefined, {
            minAmount: '100.1234',
            maxAmount: '200.5678',
        });

        expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    AND: expect.arrayContaining([
                        {
                            amount: {
                                gte: new Prisma.Decimal('100.1234'),
                                lte: new Prisma.Decimal('200.5678'),
                            },
                        },
                    ]),
                }),
            })
        );
    });

    it('rejects negative minAmount and maxAmount', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());

        await expect(
            TransactionService.getTransactionHistory('user-1', 'acc-sender', 10, undefined, {
                minAmount: '-10.00',
            })
        ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('minAmount cannot be negative') });

        await expect(
            TransactionService.getTransactionHistory('user-1', 'acc-sender', 10, undefined, {
                maxAmount: '-5.00',
            })
        ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('maxAmount cannot be negative') });
    });

    it('rejects when minAmount is greater than maxAmount', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());

        await expect(
            TransactionService.getTransactionHistory('user-1', 'acc-sender', 10, undefined, {
                minAmount: '500.00',
                maxAmount: '100.00',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('minAmount cannot be greater than maxAmount'),
        });
    });

    it('direction INCOMING filters strictly to toAccountId without overriding account ownership', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());
        prismaMock.transaction.findMany.mockResolvedValue([]);

        await TransactionService.getTransactionHistory('user-1', 'acc-sender', 10, undefined, {
            direction: 'INCOMING',
        });

        expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    AND: expect.arrayContaining([{ toAccountId: 'acc-sender' }]),
                }),
            })
        );
    });

    it('direction OUTGOING filters strictly to fromAccountId without overriding account ownership', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());
        prismaMock.transaction.findMany.mockResolvedValue([]);

        await TransactionService.getTransactionHistory('user-1', 'acc-sender', 10, undefined, {
            direction: 'OUTGOING',
        });

        expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    AND: expect.arrayContaining([{ fromAccountId: 'acc-sender' }]),
                }),
            })
        );
    });

    it('omitting direction defaults to either fromAccountId OR toAccountId', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());
        prismaMock.transaction.findMany.mockResolvedValue([]);

        await TransactionService.getTransactionHistory('user-1', 'acc-sender', 10);

        expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    AND: expect.arrayContaining([
                        {
                            OR: [
                                { fromAccountId: 'acc-sender' },
                                { toAccountId: 'acc-sender' },
                            ],
                        },
                    ]),
                }),
            })
        );
    });

    it('rejects invalid direction enum', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount());

        await expect(
            TransactionService.getTransactionHistory('user-1', 'acc-sender', 10, undefined, {
                direction: 'INVALID' as any,
            })
        ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Invalid direction') });
    });

    it('correctly maps direction IN and OUT for returned records', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount({ id: 'acc-user' }));

        const records = [
            // Outgoing transfer (user is sender)
            {
                ...makeTransactionRecord({ id: 't1', fromAccountId: 'acc-user', toAccountId: 'acc-other' }),
                fromAccount: { user: { firstName: 'Me', lastName: 'User' } },
                toAccount: { user: { firstName: 'Other', lastName: 'Person' } },
            },
            // Incoming transfer (user is receiver)
            {
                ...makeTransactionRecord({ id: 't2', fromAccountId: 'acc-other', toAccountId: 'acc-user' }),
                fromAccount: { user: { firstName: 'Other', lastName: 'Person' } },
                toAccount: { user: { firstName: 'Me', lastName: 'User' } },
            },
            // Deposit (user is toAccountId)
            {
                ...makeTransactionRecord({ id: 't3', fromAccountId: null, toAccountId: 'acc-user', type: 'DEPOSIT' as any }),
                fromAccount: null,
                toAccount: { user: { firstName: 'Me', lastName: 'User' } },
            },
            // Withdrawal (user is fromAccountId)
            {
                ...makeTransactionRecord({ id: 't4', fromAccountId: 'acc-user', toAccountId: null, type: 'WITHDRAWAL' as any }),
                fromAccount: { user: { firstName: 'Me', lastName: 'User' } },
                toAccount: null,
            },
        ];

        prismaMock.transaction.findMany.mockResolvedValue(records);

        const result = await TransactionService.getTransactionHistory('user-1', 'acc-user', 10);

        expect(result.data).toHaveLength(4);
        expect(result.data[0]?.direction).toBe('OUT'); // Outgoing transfer
        expect(result.data[1]?.direction).toBe('IN');  // Incoming transfer
        expect(result.data[2]?.direction).toBe('IN');  // Deposit
        expect(result.data[3]?.direction).toBe('OUT'); // Withdrawal
    });

    it('combines all 6 filters safely using AND semantics', async () => {
        prismaMock.account.findFirst.mockResolvedValue(makeSenderAccount({ id: 'acc-user' }));
        prismaMock.transaction.findMany.mockResolvedValue([]);

        await TransactionService.getTransactionHistory('user-1', 'acc-user', 20, 'cursor-123', {
            startDate: '2026-01-01',
            endDate: '2026-06-30',
            status: 'COMPLETED',
            type: 'TRANSFER',
            minAmount: '50.00',
            maxAmount: '1000.00',
            direction: 'INCOMING',
        });

        expect(prismaMock.transaction.findMany).toHaveBeenCalledWith({
            take: 21,
            cursor: { id: 'cursor-123' },
            skip: 1,
            orderBy: { createdAt: 'desc' },
            where: {
                AND: [
                    { toAccountId: 'acc-user' },
                    { status: 'COMPLETED' },
                    { type: 'TRANSFER' },
                    {
                        createdAt: {
                            gte: new Date('2026-01-01T00:00:00.000Z'),
                            lte: new Date('2026-06-30T23:59:59.999Z'),
                        },
                    },
                    {
                        amount: {
                            gte: new Prisma.Decimal('50.00'),
                            lte: new Prisma.Decimal('1000.00'),
                        },
                    },
                ],
            },
            include: expect.any(Object),
        });
    });

    // ---------------------------------------------------------------------------
    // Zod Schema Validation Tests for getTransactionsSchema
    // ---------------------------------------------------------------------------

    it('getTransactionsSchema accepts valid query with accountId only', () => {
        const result = getTransactionsSchema.safeParse({
            query: {
                accountId: '550e8400-e29b-41d4-a716-446655440000',
            },
        });
        expect(result.success).toBe(true);
    });

    it('getTransactionsSchema accepts all valid query parameters combined', () => {
        const result = getTransactionsSchema.safeParse({
            query: {
                accountId: '550e8400-e29b-41d4-a716-446655440000',
                limit: '25',
                cursor: '550e8400-e29b-41d4-a716-446655440001',
                startDate: '2026-01-01',
                endDate: '2026-01-31',
                status: 'COMPLETED',
                type: 'TRANSFER',
                minAmount: '10.00',
                maxAmount: '500.00',
                direction: 'OUTGOING',
            },
        });
        expect(result.success).toBe(true);
    });

    it('getTransactionsSchema accepts ISO timestamp date inputs', () => {
        const result = getTransactionsSchema.safeParse({
            query: {
                accountId: '550e8400-e29b-41d4-a716-446655440000',
                startDate: '2026-01-01T10:00:00.000Z',
                endDate: '2026-01-01T20:00:00.000Z',
            },
        });
        expect(result.success).toBe(true);
    });

    it('getTransactionsSchema rejects invalid accountId format', () => {
        const result = getTransactionsSchema.safeParse({
            query: {
                accountId: 'invalid-uuid',
            },
        });
        expect(result.success).toBe(false);
    });

    it('getTransactionsSchema rejects invalid date formats', () => {
        const result = getTransactionsSchema.safeParse({
            query: {
                accountId: '550e8400-e29b-41d4-a716-446655440000',
                startDate: 'not-a-date',
            },
        });
        expect(result.success).toBe(false);
    });

    it('getTransactionsSchema rejects when startDate is after endDate', () => {
        const result = getTransactionsSchema.safeParse({
            query: {
                accountId: '550e8400-e29b-41d4-a716-446655440000',
                startDate: '2026-02-01',
                endDate: '2026-01-01',
            },
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map(i => i.message);
            expect(messages).toContain('startDate cannot be after endDate');
        }
    });

    it('getTransactionsSchema rejects invalid status enum', () => {
        const result = getTransactionsSchema.safeParse({
            query: {
                accountId: '550e8400-e29b-41d4-a716-446655440000',
                status: 'NOT_A_STATUS',
            },
        });
        expect(result.success).toBe(false);
    });

    it('getTransactionsSchema rejects invalid type enum', () => {
        const result = getTransactionsSchema.safeParse({
            query: {
                accountId: '550e8400-e29b-41d4-a716-446655440000',
                type: 'NOT_A_TYPE',
            },
        });
        expect(result.success).toBe(false);
    });

    it('getTransactionsSchema rejects invalid direction enum', () => {
        const result = getTransactionsSchema.safeParse({
            query: {
                accountId: '550e8400-e29b-41d4-a716-446655440000',
                direction: 'SIDEWAYS',
            },
        });
        expect(result.success).toBe(false);
    });

    it('getTransactionsSchema rejects negative minAmount and maxAmount', () => {
        const resMin = getTransactionsSchema.safeParse({
            query: {
                accountId: '550e8400-e29b-41d4-a716-446655440000',
                minAmount: '-10.00',
            },
        });
        expect(resMin.success).toBe(false);

        const resMax = getTransactionsSchema.safeParse({
            query: {
                accountId: '550e8400-e29b-41d4-a716-446655440000',
                maxAmount: '-50.00',
            },
        });
        expect(resMax.success).toBe(false);
    });

    it('getTransactionsSchema rejects when minAmount is greater than maxAmount', () => {
        const result = getTransactionsSchema.safeParse({
            query: {
                accountId: '550e8400-e29b-41d4-a716-446655440000',
                minAmount: '500.00',
                maxAmount: '100.00',
            },
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map(i => i.message);
            expect(messages).toContain('minAmount cannot be greater than maxAmount');
        }
    });

    it('getTransactionsSchema rejects amounts with more than 4 decimal places', () => {
        const result = getTransactionsSchema.safeParse({
            query: {
                accountId: '550e8400-e29b-41d4-a716-446655440000',
                minAmount: '10.12345',
            },
        });
        expect(result.success).toBe(false);
    });
});