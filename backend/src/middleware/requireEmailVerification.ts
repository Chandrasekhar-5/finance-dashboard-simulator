import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { prisma } from '../lib/prisma.js';

export const requireEmailVerified = async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user?.id;
  
  if (!userId) {
    throw new AppError('Unauthorized', 401);
  }
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true }
  });
  
  if (!user?.emailVerified) {
    throw new AppError('Email verification required to access this resource', 403);
  }
  
  next();
};