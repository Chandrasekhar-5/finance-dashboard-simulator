import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';
import type { JwtPayload } from 'jsonwebtoken';

interface CustomJwtPayload extends JwtPayload {
    userId: string;
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError('Unauthorized: No token provided', 401);
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        throw new AppError('Unauthorized: Invalid token format', 401);
    }

    try {

        const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET);

        if (typeof decoded === 'object' && 'userId' in decoded) {
            req.user = { id: (decoded as CustomJwtPayload).userId };

            return next();
        }

        throw new AppError('Unauthorized: Invalid token payload', 401);

    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new AppError('Unauthorized: Token expired', 401);
        }
        throw new AppError('Unauthorized: Invalid token', 401);
    }
};