import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';


export const AccountService = {
    async getUserAccounts(userId: string) {
        const accounts = await prisma.account.findMany({ 
            where: { userId },
            orderBy: { createdAt: 'asc' }
        });
        return accounts;
    },

    async getAccountById(userId: string, accountId: string) {
        const account = await prisma.account.findFirst({
            where: { id: accountId, userId }
        });
        if (!account) throw new AppError('Account not found', 400);

        return account;
    }
};