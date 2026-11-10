import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { getTransferLimits } from '../../config/transferLimits.js';
import { AuditLogger } from '../../utils/auditLogger.js';
import { parseDateFilter } from '../../utils/dateFilter.js';

export interface TransactionFilters {
    startDate?: string | Date | undefined;
    endDate?: string | Date | undefined;
    status?: TransactionStatus | undefined;
    type?: TransactionType | undefined;
    minAmount?: string | Prisma.Decimal | undefined;
    maxAmount?: string | Prisma.Decimal | undefined;
    direction?: 'INCOMING' | 'OUTGOING' | undefined;
}

interface TransferInput {
    fromAccountId: string;
    /** Receiver identified by their account number (canonical new API). */
    toAccountNumber?: string;
    /** Receiver identified by their internal UUID (kept for backward compatibility). */
    toAccountId?: string;
    amount: string | Prisma.Decimal;
    description?: string;
    reference: string;
}

interface DepositInput {
    accountId: string;
    amount: string | Prisma.Decimal;
    description?: string;
    reference: string;
}

interface WithdrawInput {
    accountId: string;
    amount: string | Prisma.Decimal;
    description?: string;
    reference: string;
}

interface RequestContext {
    ipAddress?: string | null;
    userAgent?: string | null;
}

export const TransactionService = {
    async transferMoney(userId: string, data: TransferInput, requestContext?: RequestContext) {
        const { fromAccountId, toAccountNumber, amount, description, reference } = data;

        // ---------------------------------------------------------------------------
        // Phase 7: Resolve receiver account number → internal UUID.
        // toAccountNumber is the canonical new API field.
        // toAccountId is kept for backward compatibility with existing internal callers.
        // All downstream logic operates on resolvedToAccountId (UUID) exclusively.
        // MED-03: When toAccountNumber is used, the resolved account is kept as
        // prefetchedReceiverAccount to eliminate the redundant findUnique later.
        // ---------------------------------------------------------------------------
        let resolvedToAccountId: string;
        let prefetchedReceiverAccount: Awaited<ReturnType<typeof prisma.account.findUnique>> | null = null;
        if (toAccountNumber !== undefined) {
            const resolvedAccount = await prisma.account.findUnique({
                where: { accountNumber: toAccountNumber }
            });
            if (!resolvedAccount) throw new AppError('Receiver account not found', 404);
            resolvedToAccountId = resolvedAccount.id;
            prefetchedReceiverAccount = resolvedAccount; // MED-03: reuse to skip second fetch
        } else if (data.toAccountId !== undefined) {
            resolvedToAccountId = data.toAccountId;
        } else {
            // Guard: schema validation should prevent this, but service must be safe
            // when called directly (e.g. from tests or internal code paths).
            throw new AppError('Either toAccountNumber or toAccountId is required', 400);
        }

        if (fromAccountId === resolvedToAccountId) throw new AppError('Cannot transfer money to the same account', 400);

        const decimalAmount = amount instanceof Prisma.Decimal ? amount : new Prisma.Decimal(amount);
        const limits = getTransferLimits();

        if (decimalAmount.lt(limits.minAmount)) {
            throw new AppError('Transfer amount is below minimum limit', 400);
        }

        if (decimalAmount.gt(limits.maxAmount)) {
            throw new AppError('Transfer amount exceeds maximum per-transaction limit', 400);
        }

        const senderAccount = await prisma.account.findFirst({
            where: { id: fromAccountId, userId }
        });

        if (!senderAccount) throw new AppError('Sender account not found or unauthorized', 404);

        if (senderAccount.status !== 'ACTIVE') {
            throw new AppError(`Sender account is ${senderAccount.status.toLowerCase()}`, 400);
        }

        // MED-03: Reuse prefetchedReceiverAccount if available (toAccountNumber path),
        // otherwise fetch receiver by resolved UUID (toAccountId path).
        const receiverAccount = prefetchedReceiverAccount ?? await prisma.account.findUnique({
            where: { id: resolvedToAccountId }
        });

        if (!receiverAccount) throw new AppError('Receiver account not found', 404);

        if (receiverAccount.status !== 'ACTIVE') {
            throw new AppError(`Receiver account is ${receiverAccount.status.toLowerCase()}`, 400);
        }

        if (receiverAccount.currency !== senderAccount.currency) {
            throw new AppError('Currency mismatch between accounts', 400);
        }

        // Daily aggregate limit check (rolling 24 hours)
        const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const dailyAgg = await prisma.transaction.aggregate({
            where: {
                fromAccountId,
                type: 'TRANSFER',
                status: 'COMPLETED',
                createdAt: { gte: past24h }
            },
            _sum: { amount: true }
        });
        const dailyUsed = dailyAgg._sum.amount ?? new Prisma.Decimal(0);
        if (dailyUsed.plus(decimalAmount).gt(limits.dailyLimit)) {
            throw new AppError('Daily transfer limit exceeded', 400);
        }

        // Monthly aggregate limit check (rolling 30 days)
        const past30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const monthlyAgg = await prisma.transaction.aggregate({
            where: {
                fromAccountId,
                type: 'TRANSFER',
                status: 'COMPLETED',
                createdAt: { gte: past30d }
            },
            _sum: { amount: true }
        });
        const monthlyUsed = monthlyAgg._sum.amount ?? new Prisma.Decimal(0);
        if (monthlyUsed.plus(decimalAmount).gt(limits.monthlyLimit)) {
            throw new AppError('Monthly transfer limit exceeded', 400);
        }

        try {
            const transactionRecord = await prisma.$transaction( async (tx) => {

                const updatedSender = await tx.account.updateMany({
                    where: { id: fromAccountId, status: 'ACTIVE', balance: { gte: decimalAmount } },
                    data: { balance: { decrement: decimalAmount } }
                });

                if (updatedSender.count === 0) {
                    const checkSender = await tx.account.findUnique({ where: { id: fromAccountId } });
                    if (checkSender && checkSender.status !== 'ACTIVE') {
                        throw new AppError(`Sender account is ${checkSender.status.toLowerCase()}`, 400);
                    }
                    throw new AppError('Insufficient funds', 400);
                }

                // HIGH-01: Concurrency-safe aggregate limit checks inside serialized transaction row lock
                const txPast24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const txDailyAgg = await tx.transaction.aggregate({
                    where: {
                        fromAccountId,
                        type: 'TRANSFER',
                        status: 'COMPLETED',
                        createdAt: { gte: txPast24h }
                    },
                    _sum: { amount: true }
                });
                const txDailyUsed = txDailyAgg._sum.amount ?? new Prisma.Decimal(0);
                if (txDailyUsed.plus(decimalAmount).gt(limits.dailyLimit)) {
                    throw new AppError('Daily transfer limit exceeded', 400);
                }

                const txPast30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                const txMonthlyAgg = await tx.transaction.aggregate({
                    where: {
                        fromAccountId,
                        type: 'TRANSFER',
                        status: 'COMPLETED',
                        createdAt: { gte: txPast30d }
                    },
                    _sum: { amount: true }
                });
                const txMonthlyUsed = txMonthlyAgg._sum.amount ?? new Prisma.Decimal(0);
                if (txMonthlyUsed.plus(decimalAmount).gt(limits.monthlyLimit)) {
                    throw new AppError('Monthly transfer limit exceeded', 400);
                }

                const senderAccount = await tx.account.findUnique({ where: { id: fromAccountId } });
                if (!senderAccount) throw new AppError('Sender account not found', 404);
                const senderBalanceAfter = senderAccount.balance instanceof Prisma.Decimal
                    ? senderAccount.balance
                    : new Prisma.Decimal(senderAccount.balance);
                const senderBalanceBefore = senderBalanceAfter.plus(decimalAmount);

                const updatedReceiver = await tx.account.updateMany({
                    where: { id: resolvedToAccountId, status: 'ACTIVE' },
                    data: { balance: { increment: decimalAmount } }
                });

                if (updatedReceiver.count === 0) {
                    throw new AppError('Receiver account not found or not active', 404);
                }

                const receiverAccount = await tx.account.findUnique({ where: { id: resolvedToAccountId } });
                if (!receiverAccount) throw new AppError('Receiver account not found', 404);
                const receiverBalanceAfter = receiverAccount.balance instanceof Prisma.Decimal
                    ? receiverAccount.balance
                    : new Prisma.Decimal(receiverAccount.balance);
                const receiverBalanceBefore = receiverBalanceAfter.minus(decimalAmount);

                const record = await tx.transaction.create({
                    data: {
                        reference,
                        amount: decimalAmount,
                        type: 'TRANSFER',
                        status: 'COMPLETED',
                        description: description ?? null,
                        fromAccountId,
                        toAccountId: resolvedToAccountId,
                        senderBalanceBefore,
                        senderBalanceAfter,
                        receiverBalanceBefore,
                        receiverBalanceAfter,
                    }
                });

                return record;
            });

            await AuditLogger.log({
                userId,
                action: 'TRANSFER',
                resource: 'TRANSACTION',
                ipAddress: requestContext?.ipAddress,
                userAgent: requestContext?.userAgent,
                metadata: {
                    transactionId: transactionRecord.id,
                    reference: transactionRecord.reference,
                    fromAccountId,
                    toAccountId: resolvedToAccountId,
                    amount: decimalAmount.toString(),
                    type: 'TRANSFER',
                    status: 'COMPLETED',
                },
            });

            return transactionRecord;
        } catch (error: any) {
            if (error.code === 'P2002' && error.meta?.target?.includes('reference')) {
                throw new AppError('Duplicate transaction request', 409);
            }

            if (error.message?.includes('limit exceeded')) {
                throw error;
            }

            try {
                await prisma.transaction.create({
                    data: {
                        reference,
                        amount: decimalAmount,
                        type: 'TRANSFER',
                        status: 'FAILED',
                        description: error.message ?? 'Transfer failed',
                        fromAccountId,
                        toAccountId: resolvedToAccountId,
                        senderBalanceBefore: null,
                        senderBalanceAfter: null,
                        receiverBalanceBefore: null,
                        receiverBalanceAfter: null,
                    }
                });
            } catch {
                // Best-effort failure audit write must never change original error behavior
            }

            throw error;
        }
    },

    async depositMoney(userId: string, data: DepositInput) {
        const { accountId, amount, description, reference } = data;

        const decimalAmount = amount instanceof Prisma.Decimal ? amount : new Prisma.Decimal(amount);
        if (decimalAmount.lte(0)) throw new AppError('Amount must be greater than 0', 400);

        const account = await prisma.account.findFirst({
            where: { id: accountId, userId }
        });

        if (!account) throw new AppError('Account not found or unauthorized', 404);

        if (account.status !== 'ACTIVE') {
            throw new AppError(`Account is ${account.status.toLowerCase()}`, 400);
        }

        try {
            const transactionRecord = await prisma.$transaction(async (tx) => {
                const updatedAccount = await tx.account.updateMany({
                    where: { id: accountId, status: 'ACTIVE' },
                    data: { balance: { increment: decimalAmount } }
                });

                if (updatedAccount.count === 0) {
                    const checkAccount = await tx.account.findUnique({ where: { id: accountId } });
                    if (checkAccount && checkAccount.status !== 'ACTIVE') {
                        throw new AppError(`Account is ${checkAccount.status.toLowerCase()}`, 400);
                    }
                    throw new AppError('Account not found', 404);
                }

                const updated = await tx.account.findUnique({ where: { id: accountId } });
                if (!updated) throw new AppError('Account not found', 404);

                const receiverBalanceAfter = updated.balance instanceof Prisma.Decimal
                    ? updated.balance
                    : new Prisma.Decimal(updated.balance);
                const receiverBalanceBefore = receiverBalanceAfter.minus(decimalAmount);

                const record = await tx.transaction.create({
                    data: {
                        reference,
                        amount: decimalAmount,
                        type: 'DEPOSIT',
                        status: 'COMPLETED',
                        description: description ?? null,
                        toAccountId: accountId,
                        senderBalanceBefore: null,
                        senderBalanceAfter: null,
                        receiverBalanceBefore,
                        receiverBalanceAfter,
                    }
                });

                return record;
            });

            // MED-05: Audit successful deposit — best-effort, must not roll back the financial operation.
            try {
                await AuditLogger.log({
                    userId,
                    action: 'DEPOSIT',
                    resource: 'TRANSACTION',
                    metadata: {
                        transactionId: transactionRecord.id,
                        reference: transactionRecord.reference,
                        accountId,
                        amount: decimalAmount.toString(),
                        status: 'COMPLETED',
                    },
                });
            } catch {
                // Best-effort: audit failure must never roll back a successful deposit.
            }

            return transactionRecord;
        } catch (error: any) {
            if (error.code === 'P2002' && error.meta?.target?.includes('reference')) {
                throw new AppError('Duplicate transaction request', 409);
            }

            if (error.message?.includes('limit exceeded')) {
                throw error;
            }

            try {
                await prisma.transaction.create({
                    data: {
                        reference,
                        amount: decimalAmount,
                        type: 'DEPOSIT',
                        status: 'FAILED',
                        description: error.message ?? 'Deposit failed',
                        toAccountId: accountId,
                        senderBalanceBefore: null,
                        senderBalanceAfter: null,
                        receiverBalanceBefore: null,
                        receiverBalanceAfter: null,
                    }
                });
            } catch {
                // Best-effort
            }

            throw error;
        }
    },

    async withdrawMoney(userId: string, data: WithdrawInput) {
        const { accountId, amount, description, reference } = data;

        const decimalAmount = amount instanceof Prisma.Decimal ? amount : new Prisma.Decimal(amount);
        if (decimalAmount.lte(0)) throw new AppError('Amount must be greater than 0', 400);

        const account = await prisma.account.findFirst({
            where: { id: accountId, userId }
        });

        if (!account) throw new AppError('Account not found or unauthorized', 404);

        if (account.status !== 'ACTIVE') {
            throw new AppError(`Account is ${account.status.toLowerCase()}`, 400);
        }

        try {
            const transactionRecord = await prisma.$transaction(async (tx) => {
                const updatedAccount = await tx.account.updateMany({
                    where: { id: accountId, status: 'ACTIVE', balance: { gte: decimalAmount } },
                    data: { balance: { decrement: decimalAmount } }
                });

                if (updatedAccount.count === 0) {
                    const checkAccount = await tx.account.findUnique({ where: { id: accountId } });
                    if (!checkAccount) {
                        throw new AppError('Account not found', 404);
                    }
                    if (checkAccount.status !== 'ACTIVE') {
                        throw new AppError(`Account is ${checkAccount.status.toLowerCase()}`, 400);
                    }
                    throw new AppError('Insufficient funds', 400);
                }

                const updated = await tx.account.findUnique({ where: { id: accountId } });
                if (!updated) throw new AppError('Account not found', 404);

                const senderBalanceAfter = updated.balance instanceof Prisma.Decimal
                    ? updated.balance
                    : new Prisma.Decimal(updated.balance);
                const senderBalanceBefore = senderBalanceAfter.plus(decimalAmount);

                const record = await tx.transaction.create({
                    data: {
                        reference,
                        amount: decimalAmount,
                        type: 'WITHDRAWAL',
                        status: 'COMPLETED',
                        description: description ?? null,
                        fromAccountId: accountId,
                        senderBalanceBefore,
                        senderBalanceAfter,
                        receiverBalanceBefore: null,
                        receiverBalanceAfter: null,
                    }
                });

                return record;
            });

            // MED-05: Audit successful withdrawal — best-effort, must not roll back the financial operation.
            try {
                await AuditLogger.log({
                    userId,
                    action: 'WITHDRAWAL',
                    resource: 'TRANSACTION',
                    metadata: {
                        transactionId: transactionRecord.id,
                        reference: transactionRecord.reference,
                        accountId,
                        amount: decimalAmount.toString(),
                        status: 'COMPLETED',
                    },
                });
            } catch {
                // Best-effort: audit failure must never roll back a successful withdrawal.
            }

            return transactionRecord;
        } catch (error: any) {
            if (error.code === 'P2002' && error.meta?.target?.includes('reference')) {
                throw new AppError('Duplicate transaction request', 409);
            }

            if (error.message?.includes('limit exceeded')) {
                throw error;
            }

            try {
                await prisma.transaction.create({
                    data: {
                        reference,
                        amount: decimalAmount,
                        type: 'WITHDRAWAL',
                        status: 'FAILED',
                        description: error.message ?? 'Withdrawal failed',
                        fromAccountId: accountId,
                        senderBalanceBefore: null,
                        senderBalanceAfter: null,
                        receiverBalanceBefore: null,
                        receiverBalanceAfter: null,
                    }
                });
            } catch {
                // Best-effort
            }

            throw error;
        }
    },

    async getTransactionHistory(
        userId: string,
        accountId: string,
        limit: number = 10,
        cursor?: string,
        filters?: TransactionFilters
    ) {
        const account = await prisma.account.findFirst({
            where: { id: accountId, userId }
        });

        if (!account) throw new AppError('Account not found or unauthorized', 404);

        const andConditions: Prisma.TransactionWhereInput[] = [];

        // ---------------------------------------------------------------------------
        // Direction filter & Account ownership composition:
        // - INCOMING: filters to toAccountId (credited to user's account)
        // - OUTGOING: filters to fromAccountId (debited from user's account)
        // - default: either fromAccountId OR toAccountId must be user's account
        // ---------------------------------------------------------------------------
        if (filters?.direction === 'INCOMING') {
            andConditions.push({ toAccountId: accountId });
        } else if (filters?.direction === 'OUTGOING') {
            andConditions.push({ fromAccountId: accountId });
        } else if (filters?.direction !== undefined) {
            throw new AppError('Invalid direction filter. Must be INCOMING or OUTGOING', 400);
        } else {
            andConditions.push({
                OR: [
                    { fromAccountId: accountId },
                    { toAccountId: accountId },
                ],
            });
        }

        if (filters?.status !== undefined) {
            if (!['PENDING', 'COMPLETED', 'FAILED', 'REVERSED'].includes(filters.status)) {
                throw new AppError('Invalid transaction status', 400);
            }
            andConditions.push({ status: filters.status });
        }

        if (filters?.type !== undefined) {
            if (!['DEPOSIT', 'WITHDRAWAL', 'TRANSFER'].includes(filters.type)) {
                throw new AppError('Invalid transaction type', 400);
            }
            andConditions.push({ type: filters.type });
        }

        let parsedStart: Date | undefined;
        let parsedEnd: Date | undefined;

        if (filters?.startDate !== undefined) {
            if (filters.startDate instanceof Date) {
                if (isNaN(filters.startDate.getTime())) throw new AppError('Invalid startDate format', 400);
                parsedStart = filters.startDate;
            } else {
                if (isNaN(Date.parse(filters.startDate))) throw new AppError('Invalid startDate format', 400);
                parsedStart = parseDateFilter(filters.startDate, false);
            }
        }

        if (filters?.endDate !== undefined) {
            if (filters.endDate instanceof Date) {
                if (isNaN(filters.endDate.getTime())) throw new AppError('Invalid endDate format', 400);
                parsedEnd = filters.endDate;
            } else {
                if (isNaN(Date.parse(filters.endDate))) throw new AppError('Invalid endDate format', 400);
                parsedEnd = parseDateFilter(filters.endDate, true);
            }
        }

        if (parsedStart && parsedEnd && parsedStart > parsedEnd) {
            throw new AppError('startDate cannot be after endDate', 400);
        }

        if (parsedStart || parsedEnd) {
            const createdAtFilter: Prisma.DateTimeFilter = {};
            if (parsedStart) createdAtFilter.gte = parsedStart;
            if (parsedEnd) createdAtFilter.lte = parsedEnd;
            andConditions.push({ createdAt: createdAtFilter });
        }

        let minDec: Prisma.Decimal | undefined;
        let maxDec: Prisma.Decimal | undefined;

        if (filters?.minAmount !== undefined) {
            try {
                minDec = filters.minAmount instanceof Prisma.Decimal
                    ? filters.minAmount
                    : new Prisma.Decimal(filters.minAmount);
            } catch {
                throw new AppError('Invalid minAmount format', 400);
            }
            if (minDec.lt(0)) {
                throw new AppError('minAmount cannot be negative', 400);
            }
        }

        if (filters?.maxAmount !== undefined) {
            try {
                maxDec = filters.maxAmount instanceof Prisma.Decimal
                    ? filters.maxAmount
                    : new Prisma.Decimal(filters.maxAmount);
            } catch {
                throw new AppError('Invalid maxAmount format', 400);
            }
            if (maxDec.lt(0)) {
                throw new AppError('maxAmount cannot be negative', 400);
            }
        }

        if (minDec !== undefined && maxDec !== undefined && minDec.gt(maxDec)) {
            throw new AppError('minAmount cannot be greater than maxAmount', 400);
        }

        if (minDec !== undefined || maxDec !== undefined) {
            const amountFilter: Prisma.DecimalFilter = {};
            if (minDec !== undefined) amountFilter.gte = minDec;
            if (maxDec !== undefined) amountFilter.lte = maxDec;
            andConditions.push({ amount: amountFilter });
        }

        const query = {
            take: limit + 1,
            ...(cursor && {
                cursor: { id: cursor },
                skip: 1,
            }),
            where: {
                AND: andConditions,
            },
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                fromAccount: {
                    select: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                            },
                        },
                    },
                },
                toAccount: {
                    select: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                            },
                       },
                    },
                },
            },
        } satisfies Prisma.TransactionFindManyArgs;

        const transactions = await prisma.transaction.findMany(query);

        let nextCursor: string | undefined = undefined;
        if (transactions.length > limit) {
            const nextItem = transactions.pop();
            nextCursor = nextItem!.id;
        }

        const mappedTransactions = transactions.map(t => {
            const isMoneyOut = t.fromAccountId === accountId;
            return {
                id: t.id,
                reference: t.reference,
                amount: t.amount,
                type: t.type,
                direction: isMoneyOut ? 'OUT' : 'IN',
                status: t.status,
                description: t.description,
                createdAt: t.createdAt,
                counterparty: isMoneyOut
                    ? `${t.toAccount?.user.firstName} ${t.toAccount?.user.lastName}`
                    : `${t.fromAccount?.user.firstName} ${t.fromAccount?.user.lastName}`
            }
        });

        return { data: mappedTransactions, nextCursor };
    }
};