import { z } from 'zod';

export const transferSchema = z.object({
    body: z.object({
        fromAccountId: z.string().uuid(),
        toAccountId: z.string().uuid(),
        amount: z.number().positive('Amount must be greater than 0'),
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