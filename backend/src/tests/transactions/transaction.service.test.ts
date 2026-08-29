import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { prismaMock } from '../setup.js';
import { TransactionService } from '../../modules/transactions/transaction.service.js';
import { transferSchema } from '../../modules/transactions/transaction.schema.js';
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
