import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { Prisma } from '@prisma/client';
import { getTransferLimits } from '../../config/transferLimits.js';

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

export const TransactionService = {
    async transferMoney(userId: string, data: TransferInput) {
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
                    where: { id: fromAccountId, balance: { gte: decimalAmount } },
                    data: { balance: { decrement: decimalAmount } }
                });

                if (updatedSender.count === 0) throw new AppError('Insufficient funds', 400);

                const updatedReceiver = await tx.account.updateMany({
                    where: { id: toAccountId },
                    data: { balance: { increment: decimalAmount } }
                });

                if (updatedReceiver.count === 0) {
                    throw new AppError('Receiver account not found', 404);
                }

                const record = await tx.transaction.create({
                    data: {
                        reference,
                        amount: decimalAmount,
                        type: 'TRANSFER',
                        status: 'COMPLETED',
                        description: description ?? null,
                        fromAccountId,
                        toAccountId
                    }
                });

                return record;
            });

            return transactionRecord;
        } catch (error: any) {

            if (error.code === 'P2002' && error.meta?.target?.includes('reference')) {
                throw new AppError('Duplicate transaction request', 409);
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

                const record = await tx.transaction.create({
                    data: {
                        reference,
                        amount: decimalAmount,
                        type: 'DEPOSIT',
                        status: 'COMPLETED',
                        description: description ?? null,
                        toAccountId: accountId
                    }
                });

                return record;
            });

            return transactionRecord;
        } catch (error: any) {
            if (error.code === 'P2002' && error.meta?.target?.includes('reference')) {
                throw new AppError('Duplicate transaction request', 409);
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

                const record = await tx.transaction.create({
                    data: {
                        reference,
                        amount: decimalAmount,
                        type: 'WITHDRAWAL',
                        status: 'COMPLETED',
                        description: description ?? null,
                        fromAccountId: accountId
                    }
                });

                return record;
            });

            return transactionRecord;
        } catch (error: any) {
            if (error.code === 'P2002' && error.meta?.target?.includes('reference')) {
                throw new AppError('Duplicate transaction request', 409);
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