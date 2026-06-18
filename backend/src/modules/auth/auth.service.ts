import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { env } from '../../config/env.js';
import { TokenStorage } from '../../utils/tokenStorage.js';
import { PasswordResetService } from '../../utils/passwordReset.js';
import { EmailVerificationService } from '../../utils/emailVerification.js';
import { EmailService } from '../../services/email.service.js';


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
                passwordHash: passwordHash,
                emailVerified: false
            }
        });

        const token = await EmailVerificationService.generateVerificationToken(user.id);

        if (env.NODE_ENV === 'development') {
            console.log(`Email verification token: ${user.email}: ${token}`);
            console.log(`Verification link: http://localhost:5000/api/v1/auth/verify-email?token=${token}`);
        }

        await EmailService.sendVerificationEmail(data.email, token);

        return this.generateToken(user.id);
    },

    async login(data: LoginInput, deviceInfo?: DeviceInfo) {
        const user = await prisma.user.findUnique({ where: { email: data.email } });

        if (!user) throw new AppError('Invalid email or password', 401);

        if (!user.emailVerified) throw new AppError('Please verify your email address before logging in', 403);

        if (!user.passwordHash) throw new AppError('This account uses Google login. Please sign in with Google.',400);

        const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
        if (!isPasswordValid) throw new AppError('Invalid credentials', 401);

        return this.generateToken(user.id, deviceInfo);
    },

    async resendVerificationEmail(email: string): Promise<void> {
        await EmailVerificationService.resendVerificationEmail(email);
    },

    async verifyEmail(token: string): Promise<void> {
        await EmailVerificationService.verifyEmail(token);
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
    },

    async forgotPassword(email: string) {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) return;

        const resetToken = await PasswordResetService.generateResetToken(user.id);

        if (env.NODE_ENV === 'development') {
            console.log(`Reset token for ${email}: ${resetToken}`);
            return;
        }

        await EmailService.sendPasswordResetEmail(email, resetToken);
    },

    async resetPassword(token: string, newPassword: string) {
        const userId = await PasswordResetService.verifyResetToken(token);

        const passwordHash = await bcrypt.hash(newPassword, 10);

        await prisma.user.updateMany({
            where: { id: userId },
            data: { passwordHash }
        });

        await PasswordResetService.markTokenAsRead(token);

        await TokenStorage.deleteAllUserRefreshTokens(userId);
    },

    async changePassword(userId: string, currentPassword: string, newPassword: string) {
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) throw new AppError('User not found', 404);

        if (!user.passwordHash) throw new AppError('This account uses Google login. Please sign in with Google.',400);

        const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isPasswordValid) throw new AppError('Invalid credentials', 401);

        const passwordHash = await bcrypt.hash(newPassword, 10);

        await prisma.user.updateMany({
            where: { id:userId },
            data: { passwordHash }
        });

        await TokenStorage.deleteAllUserRefreshTokens(userId);
    }
};