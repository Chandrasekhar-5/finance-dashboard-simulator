import { z } from 'zod';

/**
 * MED-04: Validates that the `accountId` route parameter is a valid UUID.
 * This prevents non-UUID strings from reaching the database query and
 * returns a consistent 400 response for malformed identifiers.
 */
export const accountByIdSchema = z.object({
    params: z.object({
        accountId: z.string().uuid('accountId must be a valid UUID'),
    }),
});
