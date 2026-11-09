import type { Request, Response } from 'express';
import passport from 'passport';
import { AuthService, type DeviceInfo } from './auth.service.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { prisma } from '../../lib/prisma.js';
import { createOAuthTicket, consumeOAuthTicket } from '../../utils/oauthTicketStore.js';

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
        const deviceInfo: DeviceInfo = {
          deviceId: (req.headers['x-device-id'] as string | undefined) ?? undefined,
          deviceName: (req.headers['x-device-name'] as string | undefined) ?? undefined,
          ipAddress: (req.ip || req.socket.remoteAddress) ?? undefined,
          userAgent: (req.headers['user-agent'] as string | undefined) ?? undefined,
        };

        // HIGH-03: Create a short-lived single-use authorization ticket in shared database storage.
        // Access token is NEVER placed in redirect URL or query parameters.
        const ticket = await createOAuthTicket(user.id, deviceInfo);

        // OAuth Callback Security: Strict Referrer-Policy and Cache-Control headers
        // prevent leaking the ticket parameter in Referer headers or disk/browser cache.
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');

        const redirectUrl = `${env.FRONTEND_URL}/oauth-callback?ticket=${encodeURIComponent(ticket)}`;
        res.redirect(redirectUrl);
      } catch (error) {
        res.redirect(`${env.FRONTEND_URL}/login?error=token_generation_failed`);
      }
    })(req, res);
  },

  async exchangeTicket(req: Request, res: Response) {
    const { ticket } = req.body;
    if (!ticket || typeof ticket !== 'string') {
      throw new AppError('Ticket is required', 400);
    }

    const ticketData = await consumeOAuthTicket(ticket);
    if (!ticketData) {
      throw new AppError('Invalid or expired authorization ticket', 400);
    }

    const deviceInfo: DeviceInfo = {
      deviceId: (req.headers['x-device-id'] as string | undefined) ?? ticketData.deviceInfo?.deviceId,
      deviceName: (req.headers['x-device-name'] as string | undefined) ?? ticketData.deviceInfo?.deviceName,
      ipAddress: (req.ip || req.socket.remoteAddress || ticketData.deviceInfo?.ipAddress) ?? undefined,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? ticketData.deviceInfo?.userAgent,
    };

    const { accessToken, refreshToken, userId } = await AuthService.generateToken(
      ticketData.userId,
      deviceInfo
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      data: {
        accessToken,
        userId,
      },
    });
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