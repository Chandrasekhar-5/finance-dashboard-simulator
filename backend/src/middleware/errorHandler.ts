import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal server error';

    console.log(`[Error] ${err.message}`, err.stack);

    res.status(statusCode).json({
        success: false,
        error: message,
        stack: env.NODE_ENV === 'development' ? err.stack : 'Undefined',
    });
}