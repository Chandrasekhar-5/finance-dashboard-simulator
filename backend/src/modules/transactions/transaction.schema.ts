import { z } from 'zod';
import { Prisma } from '@prisma/client';

export const transferSchema = z.object({
    body: z.object({
        fromAccountId: z.string().uuid(),
        toAccountId: z.string().uuid(),
        amount: z.string()
            .regex(/^\d+(\.\d{1,4})?$/, 'Amount must be a positive decimal with up to 4 decimal places')
            .refine((val) => {
                try {
                    const d = new Prisma.Decimal(val);
                    return d.gt(new Prisma.Decimal('0'));
                } catch {
                    return false;
                }
            }, 'Amount must be greater than 0'),
        description: z.string().max(255).optional(),
        reference: z.string().uuid('Must provide a unique idempotency key')
    })
});


export const getTransactionsSchema = z.object({
    query: z.object({
        accountId: z.string().uuid("Invalid accountId format"),
        limit: z.string().optional().transform(val => (val ? parseInt(val) : 10)),
        cursor: z.string().uuid("Invalid cursor format").optional()
    })
});