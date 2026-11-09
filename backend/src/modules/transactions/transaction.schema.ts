import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { getTransferLimits } from '../../config/transferLimits.js';

export const transferSchema = z.object({
    body: z.object({
        fromAccountId: z.string().uuid(),
        // Canonical new field: receiver identified by account number (10-digit string).
        // toAccountId is kept for backward compatibility with existing internal callers.
        // Exactly one of toAccountNumber or toAccountId must be provided.
        toAccountNumber: z
            .string()
            .regex(/^\d{10}$/, 'Account number must be exactly 10 digits')
            .optional(),
        toAccountId: z.string().uuid().optional(),
        amount: z.string()
            .regex(/^\d+(\.\d{1,4})?$/, 'Amount must be a positive decimal with up to 4 decimal places')
            .refine((val) => {
                try {
                    const d = new Prisma.Decimal(val);
                    const limits = getTransferLimits();
                    return d.gte(limits.minAmount);
                } catch {
                    return false;
                }
            }, 'Transfer amount is below minimum limit')
            .refine((val) => {
                try {
                    const d = new Prisma.Decimal(val);
                    const limits = getTransferLimits();
                    return d.lte(limits.maxAmount);
                } catch {
                    return false;
                }
            }, 'Transfer amount exceeds maximum per-transaction limit'),
        description: z.string().max(255).optional(),
        reference: z.string().uuid('Must provide a unique idempotency key')
    }).superRefine((body, ctx) => {
        const hasNum = body.toAccountNumber !== undefined;
        const hasId  = body.toAccountId   !== undefined;
        if (!hasNum && !hasId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Either toAccountNumber or toAccountId is required',
                path: ['toAccountNumber'],
            });
        }
        if (hasNum && hasId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Provide only one of toAccountNumber or toAccountId, not both',
                path: ['toAccountNumber'],
            });
        }
    })
});


export const getTransactionsSchema = z.object({
    query: z.object({
        accountId: z.string().uuid("Invalid accountId format"),
        limit: z.string().optional().transform(val => (val ? parseInt(val) : 10)),
        cursor: z.string().uuid("Invalid cursor format").optional()
    })
});