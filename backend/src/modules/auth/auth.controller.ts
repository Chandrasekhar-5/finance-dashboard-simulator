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
        path: '/api/v1/auth',
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
}

const getDeviceInfo = (req: Request) => {
    return {
        deviceId: req.headers['x-device-id'] as string,
        deviceName: req.headers['x-device-name'] as string,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent']
    };
}


export const AuthController = {
    async register(req: Request, res: Response) {
        const { accessToken, refreshToken, userId } = await AuthService.register(req.body);
        setRefreshCookie(res, refreshToken);
        
        res.status(201).json({ success: true, data: { userId, accessToken } });
    },

    async login(req: Request, res: Response) {
        const deviceInfo = getDeviceInfo(req);
        const { accessToken, refreshToken, userId } = await AuthService.login(req.body, deviceInfo);
        setRefreshCookie(res, refreshToken);

        res.status(200).json({ success: true, data: { userId, accessToken } });
    },

    async logout(req: Request, res: Response) {
        const refreshToken = req.cookies.refreshToken;
        const userId = req.user?.id;

        if (refreshToken && userId) {
            await AuthService.logout(refreshToken, userId);
        }

        res.clearCookie('refreshToken', { path: '/api/v1/auth' });
        res.status(200).json({ success: true, message: 'Logged out successfully' });
    },

    async logoutAllDevices(req: Request, res: Response) {
        const userId = req.user?.id;

        if (!userId) throw new AppError('Unauthorized', 401);

        await AuthService.logoutAllDevices(userId);
        res.status(200).json({ success: true, message: 'Logged out from all devices successfully' });
    },

    async refresh(req: Request, res: Response) {
        const currentRefreshToken = req.cookies.refreshToken;

        if (!currentRefreshToken) throw new AppError('Refresh token not found', 401);

        const deviceInfo = getDeviceInfo(req);

        const { accessToken, refreshToken, userId } = await AuthService.refreshToken(currentRefreshToken, deviceInfo);

        setRefreshCookie(res, refreshToken);

        res.status(200).json({ success: true, data: { userId, accessToken } });
    },

    async getSessions(req:Request, res: Response) {
        const userId = req.user!.id;
        const sessions = await AuthService.getSessions(userId);
        res.status(200).json({ success: true, data: sessions });
    },

    async revokeSession(req: Request, res: Response) {
    const userId = req.user!.id;
    const { sessionId } = req.params;
    
    await AuthService.revokeSession(sessionId, userId);
    res.status(200).json({ success: true, message: 'Session revoked successfully' });
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