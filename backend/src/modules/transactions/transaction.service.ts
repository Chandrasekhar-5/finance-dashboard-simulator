import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';

interface Transaction {
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    description?: string,
    reference: string
}

export const TransactionService = {
    async transferMoney(userId: string, data: Transaction) {
        const { fromAccountId, toAccountId, amount, description, reference } = data;

        if (fromAccountId === toAccountId) throw new AppError('Cannot transfer money to the same account', 400);

        const senderAccount = await prisma.account.findFirst({
            where: { id: fromAccountId, userId }
        });

        if (!senderAccount) throw new AppError('Sender account not found or unauthorized', 404);

        try {
            const transactionRecord = await prisma.$transaction( async (tx) => {

                const updatedSender = await tx.account.updateMany({
                    where: { id: fromAccountId, balance: { gte: amount } },
                    data: { balance: { decrement: amount } }
                });

                if (updatedSender.count === 0) throw new AppError('Insufficient funds', 400);

                const updatedReceiver = await tx.account.updateMany({
                    where: { id: toAccountId },
                    data: { balance: { increment: amount } }
                });

                if (updatedReceiver.count === 0) {
                    throw new AppError('Receiver account not found', 404);
                }

                const record = await tx.transaction.create({
                    data: {
                        reference,
                        amount,
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

    async getTransactionHistory(userId: string, accountId: string, limit: number, cursor?: string) {
        const account = await prisma.account.findFirst({
            where: { id: accountId, userId }
        });

        if (!account) throw new AppError('Account not found or unauthorized', 404);

        const transaction = await prisma.transaction.findMany({
            take: limit + 1,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            where: {
                OR: [
                    { fromAccountId: accountId },
                    { toAccountId: accountId }
                ]
            },
            orderBy: { createdAt: 'desc' },
            include: {
                fromAccount: { select: { user: { select: { firstName: true, lastName: true } } } },
                toAccount: { select: { user: { select: { firstName: true, lastName: true } } } }
            }
        });

        let nextCursor: string | undefined = undefined;
        if (transaction.length > limit) {
            const nextItem = transaction.pop();
            nextCursor = nextItem!.id;
        }

        const mappedTransactions = transaction.map(t => {
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