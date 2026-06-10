import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { AppError } from './AppError.js';


export const PasswordResetService = {
    async generateResetToken(userId: string): Promise<string> {
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        await prisma.passwordReset.deleteMany({
            where: {
                userId,
                usedAt: null,
                expiresAt: { gt: new Date() }
            }
        });

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);

        await prisma.passwordReset.create({
            data: {
                userId,
                tokenHash,
                expiresAt
            }
        });

        return token;
    },

    
    async verifyResetToken(token: string): Promise<string> {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        
        const resetRecord = await prisma.passwordReset.findFirst({
            where: {
                tokenHash,
                usedAt: null,
                expiresAt: { gt: new Date() }
            },
            include: { user: true }
        });

        if (!resetRecord) throw new AppError('Invalid or expired reset token', 400);

        return resetRecord.userId;
    },


    async markTokenAsRead(token: string): Promise<void> {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        await prisma.passwordReset.updateMany({
            where: { tokenHash },
            data: { usedAt: new Date() }
        });
    }
};