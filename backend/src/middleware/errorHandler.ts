import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { redactOAuthTicketInString } from '../utils/oauthTicketStore.js';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal server error';

    const safeMessage = typeof err.message === 'string' ? redactOAuthTicketInString(err.message) : err.message;
    const safeStack = typeof err.stack === 'string' ? redactOAuthTicketInString(err.stack) : err.stack;

    console.error(`[Error] ${safeMessage}`, safeStack);
    res.status(statusCode).json({
        success: false,
        error: message,
        stack: env.NODE_ENV === 'development' ? err.stack : 'Undefined',
    });
}