import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { env } from '../../config/env.js';
import { TokenStorage } from '../../utils/tokenStorage.js';


interface RegisterInput {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
}

interface LoginInput {
    email: string;
    password: string;
}

interface DeviceInfo {
    deviceId?: string;
    deviceName?: string;
    ipAddress?: string;
    userAgent?: string;
}

export const AuthService = {
    async register(data: RegisterInput) {
        const existingUser = await prisma.user.findUnique({ where: { email: data.email } });

        if (existingUser) {
            throw new AppError('Email already in use', 409);
        }

        const passwordHash = await bcrypt.hash(data.password, 10);

        const user = await prisma.user.create({
            data: {
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                passwordHash: passwordHash
            }
        });
        return this.generateToken(user.id);
    },

    async login(data: LoginInput, deviceInfo?: DeviceInfo) {
        const user = await prisma.user.findUnique({ where: { email: data.email } });

        if (!user) throw new AppError('Invalid email or password', 401);

        const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
        if (!isPasswordValid) throw new AppError('Invalid credentials', 401);

        return this.generateToken(user.id, deviceInfo);
    },

    async refreshToken(refreshToken: string, deviceInfo?: DeviceInfo) {
        try {

            const decoded = jwt.verify(refreshToken, env.REFRESH_TOKEN_SECRET) as { userId: string };

            const isValid = await TokenStorage.validateRefreshToken(decoded.userId, refreshToken);

            if (!isValid) throw new AppError('Invalid or expired refresh token', 401);

            await TokenStorage.deleteRefreshToken(decoded.userId, refreshToken);

            const user  = await prisma.user.findUnique({ where: { id: decoded.userId } });

            if (!user) throw new AppError('User not found', 404);

            return this.generateToken(user.id, deviceInfo);
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }

            throw new AppError('Invalid or expired refresh token', 401);
        }
    },

    async logout(refreshToken: string) {
        if (!refreshToken) throw new AppError('Refresh token not found', 401);

        try {
            const decoded = jwt.verify(refreshToken, env.REFRESH_TOKEN_SECRET) as { userId: string };

            await TokenStorage.deleteRefreshToken(decoded.userId, refreshToken);
        } catch (error) {
            throw new AppError('Invalid or expired refresh token', 401);
        }
    },

    async logoutAllDevices(userId: string) {
        await TokenStorage.deleteAllUserRefreshTokens(userId);
    },

    async getSessions(userId: string) {
        return TokenStorage.getUserSessions(userId);
    },

    async revokeSession(sessionId: string, userId: string) {
        await TokenStorage.revokeSession(sessionId, userId);
    },

    async generateToken(userId: string, deviceInfo?: DeviceInfo) {
        const accessToken = jwt.sign({ userId }, env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
        const refreshToken = jwt.sign({ userId }, env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

        await TokenStorage.storeRefreshToken(userId, refreshToken, deviceInfo);

        return { accessToken, refreshToken, userId };
    }
};