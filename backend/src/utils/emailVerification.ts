import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { AppError } from './AppError.js';
import { env } from '../config/env.js';


export const EmailVerificationService = {
    async generateVerificationToken(userId: string): Promise<string> {
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        await prisma.emailVerification.deleteMany({
            where: {
                userId,
                usedAt: null,
                expiresAt: { gt: new Date() }
            }
        });

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24)

        await prisma.emailVerification.create({
            data: {
                userId,
                tokenHash,
                expiresAt
            }
        });

        return token;
    },

    async verifyEmail(token: string): Promise<void> {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const verifiedRecord = await prisma.emailVerification.findFirst({
            where: {
                tokenHash,
                usedAt: null,
                expiresAt: { gt: new Date() }
            },
            include: { user: true }
        });

        if (!verifiedRecord) throw new AppError('Invalid or expired verification token', 400);

        await prisma.user.update({
            where: { id: verifiedRecord.userId },
            data: {
                emailVerified: true,
                emailVerifiedAt: new Date()
            }
        });

        await prisma.emailVerification.update({
            where: { id: verifiedRecord.id },
            data: { usedAt: new Date() }
        });
    },

    async resendVerificationEmail(email: string): Promise<void> {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) return;

        if (user.emailVerified) throw new AppError('Email already verified', 400);
        
        else {
        const token = await this.generateVerificationToken(user.id);

        if (env.NODE_ENV === 'development') {
            console.log(`Email verification token: ${email}: ${token}`);
            console.log(`Verification link: http://localhost:5000/api/v1/auth/verify-email?token=${token}`);
        }
    }
    },

    async isEmailVerified(userId: string): Promise<boolean> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { emailVerified: true }
        });
        return user?.emailVerified ?? false;
    }
};