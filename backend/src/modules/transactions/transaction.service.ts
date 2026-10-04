import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { Prisma } from '@prisma/client';
import { getTransferLimits } from '../../config/transferLimits.js';
import { AuditLogger } from '../../utils/auditLogger.js';

interface TransferInput {
    fromAccountId: string;
    toAccountId: string;
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
        const { fromAccountId, toAccountId, amount, description, reference } = data;

        if (fromAccountId === toAccountId) throw new AppError('Cannot transfer money to the same account', 400);

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

        const receiverAccount = await prisma.account.findUnique({
            where: { id: toAccountId }
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

                const senderAccount = await tx.account.findUnique({ where: { id: fromAccountId } });
                if (!senderAccount) throw new AppError('Sender account not found', 404);
                const senderBalanceAfter = senderAccount.balance instanceof Prisma.Decimal
                    ? senderAccount.balance
                    : new Prisma.Decimal(senderAccount.balance);
                const senderBalanceBefore = senderBalanceAfter.plus(decimalAmount);

                const updatedReceiver = await tx.account.updateMany({
                    where: { id: toAccountId, status: 'ACTIVE' },
                    data: { balance: { increment: decimalAmount } }
                });

                if (updatedReceiver.count === 0) {
                    throw new AppError('Receiver account not found or not active', 404);
                }

                const receiverAccount = await tx.account.findUnique({ where: { id: toAccountId } });
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
                        toAccountId,
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
                    toAccountId,
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

            try {
                await prisma.transaction.create({
                    data: {
                        reference,
                        amount: decimalAmount,
                        type: 'TRANSFER',
                        status: 'FAILED',
                        description: error.message ?? 'Transfer failed',
                        fromAccountId,
                        toAccountId,
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

        try {
            const transactionRecord = await prisma.$transaction(async (tx) => {
                const updatedAccount = await tx.account.updateMany({
                    where: { id: accountId },
                    data: { balance: { increment: decimalAmount } }
                });

                if (updatedAccount.count === 0) {
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

            return transactionRecord;
        } catch (error: any) {
            if (error.code === 'P2002' && error.meta?.target?.includes('reference')) {
                throw new AppError('Duplicate transaction request', 409);
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

        try {
            const transactionRecord = await prisma.$transaction(async (tx) => {
                const updatedAccount = await tx.account.updateMany({
                    where: { id: accountId, balance: { gte: decimalAmount } },
                    data: { balance: { decrement: decimalAmount } }
                });

                if (updatedAccount.count === 0) throw new AppError('Insufficient funds', 400);

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

            return transactionRecord;
        } catch (error: any) {
            if (error.code === 'P2002' && error.meta?.target?.includes('reference')) {
                throw new AppError('Duplicate transaction request', 409);
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

    async getTransactionHistory(userId: string, accountId: string, limit: number, cursor?: string) {
        const account = await prisma.account.findFirst({
            where: { id: accountId, userId }
        });

        if (!account) throw new AppError('Account not found or unauthorized', 404);

        const query = {
            take: limit + 1,
            ...(cursor && {
                cursor: { id: cursor },
                skip: 1,
            }),
            where: {
                OR: [
                    { fromAccountId: accountId },
                    { toAccountId: accountId },
                ],
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