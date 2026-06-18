import type { Request, Response } from 'express';
import passport from 'passport';
import { AuthService } from './auth.service.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { prisma } from '../../lib/prisma.js';

export const OAuthController = {
  googleAuth: passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  }),

  googleCallback: (req: Request, res: Response) => {
    passport.authenticate('google', { session: false }, async (err: any, user: any) => {
      if (err || !user) {
        return res.redirect(`${env.FRONTEND_URL}/login?error=auth_failed`);
      }

      try {
        const deviceInfo = {
          deviceId: req.headers['x-device-id'] as string,
          deviceName: req.headers['x-device-name'] as string,
          ipAddress: req.ip || req.socket.remoteAddress || '',
          userAgent: req.headers['user-agent'] || '',
        };

        const { accessToken, refreshToken } = await AuthService.generateToken(user.id, deviceInfo);

        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/api/v1/auth',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        const redirectUrl = `${env.FRONTEND_URL}/oauth-callback?accessToken=${accessToken}`;
        res.redirect(redirectUrl);
      } catch (error) {
        res.redirect(`${env.FRONTEND_URL}/login?error=token_generation_failed`);
      }
    })(req, res);
  },

  async linkGoogle(req: Request, res: Response) {
    res.status(501).json({ success: false, message: 'Not implemented yet' });
  },

  async unlinkOAuth(req: Request, res: Response) {
    const userId = req.user!.id;
    const provider = req.params.provider as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      throw new AppError('Cannot unlink OAuth account. Please set a password first.', 400);
    }

    if (!provider) throw new AppError('Provider is required', 400);

    await prisma.oAuthAccount.deleteMany({
      where: {
        userId,
        provider,
      },
    });

    res.status(200).json({ success: true, message: `${provider} account unlinked successfully` });
  },
};