import type { Request, Response } from 'express';
import { TransactionService } from './transaction.service.js';


export const TransactionController = {
    async transfer(req: Request, res: Response) {
        const transaction = await TransactionService.transferMoney(req.user!.id, req.body);

        res.status(200).json({ success: true, message: 'Transaction successful', data: transaction });
    }
};