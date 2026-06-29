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