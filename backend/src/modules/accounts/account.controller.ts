import type {Request, Response } from 'express';
import { AccountService } from './account.service.js';
import { AppError } from '../../utils/AppError.js';


export const AccountController = {
    async getMyAccounts(req: Request, res: Response) {
        const accounts = await AccountService.getUserAccounts(req.user!.id);
        res.status(200).json({ success: true, data: accounts });
    },

    async getAccountDetails(req: Request, res: Response) {
        const { accountId } = req.params;
        console.log(accountId);

        if(!accountId || Array.isArray(accountId)) throw new AppError('Account not found', 404);

        const account = await AccountService.getAccountById(req.user!.id, accountId);

        res.status(200).json({ success: true, data: account });
    }
}