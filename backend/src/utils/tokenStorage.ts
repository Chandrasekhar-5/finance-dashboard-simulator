import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';


export const TokenStorage = {
    async hashToken(token: string): Promise<string> {
        return crypto.createHash('sha256').update(token).digest('hex');
    },

    async storeRefreshToken(userId: string, refreshToken: string, deviceInfo?: {
        deviceId?: string;
        deviceName?: string;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<void> {
        
        const tokenHash = await this.hashToken(refreshToken);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        if (deviceInfo?.deviceId) {
            await prisma.refreshToken.deleteMany({
                where: {
                    userId,
                    deviceId: deviceInfo.deviceId
                }
            });
        }

        await prisma.refreshToken.create({
            data: {
                userId,
                tokenHash,
                deviceId: deviceInfo?.deviceId ?? null,
                deviceName: deviceInfo?.deviceName ?? null,
                ipAddress: deviceInfo?.ipAddress ?? null,
                UserAgent: deviceInfo?.userAgent ?? null,
                expiresAt
            }
        });
    },

    async validateRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
        const tokenHash = await this.hashToken(refreshToken);
        const tokenRecord = await prisma.refreshToken.findFirst({
            where: {
                userId,
                tokenHash,
                expiresAt: { gt: new Date() }
            }
        });
        return !!tokenRecord;
    },
    
    async deleteRefreshToken(userId: string, refreshToken: string): Promise<void> {
        const tokenHash = await this.hashToken(refreshToken);
        await prisma.refreshToken.deleteMany({
            where: {
                userId,
                tokenHash
            }
        });
    },

    async deleteAllUserRefreshTokens(userId: string): Promise<void> {
        await prisma.refreshToken.deleteMany({
            where: { userId }
        });
    },

    async getUserSessions(userId: string) {
        return prisma.refreshToken.findMany({
            where: {
                userId,
                expiresAt: { gt: new Date() }
            },
            select: {
                id: true,
                deviceId: true,
                deviceName: true,
                ipAddress: true,
                UserAgent: true,
                createdAt: true,
                expiresAt: true
            },
            orderBy: { createdAt: 'desc' }
        });
    },

    async revokeSession(sessionId: string, userId: string): Promise<void> {
        await prisma.refreshToken.deleteMany({
            where: {
                id: sessionId,
                userId
            }
        });
    }
};