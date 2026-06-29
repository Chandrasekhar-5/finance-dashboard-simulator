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
    }
};