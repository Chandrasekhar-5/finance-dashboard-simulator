import type { Request, Response } from 'express';
import { TransactionService } from './transaction.service.js';
import { extractRequestContext } from '../../utils/auditLogger.js';


export const TransactionController = {
    async transfer(req: Request, res: Response) {
        const transaction = await TransactionService.transferMoney(
            req.user!.id,
            req.body,
            extractRequestContext(req)
        );

        res.status(200).json({ success: true, message: 'Transaction successful', data: transaction });
    },

    async getHistory(req: Request, res: Response) {
        const { accountId, limit, cursor } = req.query;

        const result = await TransactionService.getTransactionHistory(
            req.user!.id,
            accountId as string,
            Number(limit),
            cursor as string
        );

        res.status(200).json({ success: true, ...result });
    }
};