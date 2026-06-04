import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { prisma } from '../../lib/prisma.js';


const setRefreshCookie = (res: Response, token: string) => {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
}


export const AuthController = {
    async register(req: Request, res: Response) {
        const { accessToken, refreshToken, userId } = await AuthService.register(req.body);
        setRefreshCookie(res, refreshToken);
        
        res.status(201).json({ success: true, data: { userId, accessToken } });
    },

    async login(req: Request, res: Response) {
        const { accessToken, refreshToken, userId } = await AuthService.login(req.body);
        setRefreshCookie(res, refreshToken);

        res.status(200).json({ success: true, data: { userId, accessToken } });
    },

    async logout(req: Request, res: Response) {
        res.clearCookie('refreshToken');
        res.status(200).json({ success: true, message: 'Logged out successfully' });
    },

    async refresh(req: Request, res: Response) {
        const currentRefreshToken = req.cookies.refreshToken;

        if (!currentRefreshToken) throw new AppError('Refresh token not found', 401);

        const { accessToken, refreshToken, userId } = await AuthService.refreshToken(currentRefreshToken);

        setRefreshCookie(res, refreshToken);

        res.status(200).json({ success: true, data: { userId, accessToken } });
    },

    async getme(req: Request, res: Response) {
        const userId = req.user!.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, firstName: true, lastName: true }
        });

        res.status(200).json({ success: true, data: user });
    }
};