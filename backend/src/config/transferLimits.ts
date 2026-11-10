import { Prisma } from '@prisma/client';
import { env } from './env.js';

export const getTransferLimits = () => ({
    minAmount: new Prisma.Decimal(env.TRANSFER_MIN_AMOUNT),
    maxAmount: new Prisma.Decimal(env.TRANSFER_MAX_AMOUNT),
    dailyLimit: new Prisma.Decimal(env.TRANSFER_DAILY_LIMIT),
    monthlyLimit: new Prisma.Decimal(env.TRANSFER_MONTHLY_LIMIT),
});

