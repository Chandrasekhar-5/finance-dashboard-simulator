import type { Request, Response, NextFunction } from 'express';
import { ZodObject, ZodError } from 'zod';
export const validate = (schema: ZodObject<any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params
            });
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({
                    success: false,
                    message: 'Validation error',
                    details: error.issues.map(e => ({ path: e.path.join('.'), message: e.message }))
                });
                return;
            }
            next(error);
        }
    };
};