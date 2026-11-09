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
        const {
            accountId,
            limit,
            cursor,
            startDate,
            endDate,
            status,
            type,
            minAmount,
            maxAmount,
            direction,
        } = req.query;

        const result = await TransactionService.getTransactionHistory(
            req.user!.id,
            accountId as string,
            limit ? Number(limit) : 10,
            cursor as string | undefined,
            {
                startDate: startDate as string | undefined,
                endDate: endDate as string | undefined,
                status: status as any,
                type: type as any,
                minAmount: minAmount as string | undefined,
                maxAmount: maxAmount as string | undefined,
                direction: direction as any,
            }
        );

        res.status(200).json({ success: true, ...result });
    }
};