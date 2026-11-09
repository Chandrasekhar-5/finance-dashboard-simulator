import passport from 'passport';
import { Strategy as GoogleStrategy, type Profile, type VerifyCallback } from 'passport-google-oauth20';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { EmailService } from '../services/email.service.js';
import { generateAccountNumber } from '../utils/generateAccountNumber.js';
import { AuditLogger } from '../utils/auditLogger.js';

export const handleGoogleAuth = async (
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback
) => {
    try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
            return done(new AppError('No email found from Google', 400));
        }

        // 1. Check if OAuthAccount already exists for this Google providerId
        const oauthAccount = await prisma.oAuthAccount.findUnique({
            where: {
                provider_providerId: {
                    provider: 'google',
                    providerId: profile.id,
                },
            },
            include: { user: true },
        });

        if (oauthAccount) {
            await prisma.$transaction([
                prisma.oAuthAccount.update({
                    where: { id: oauthAccount.id },
                    data: {
                        name: profile.displayName,
                        avatar: profile.photos?.[0]?.value ?? null,
                        email,
                    },
                }),

                prisma.user.update({
                    where: { id: oauthAccount.user.id },
                    data: {
                        avatar: profile.photos?.[0]?.value ?? null,
                    },
                }),
            ]);

            return done(null, oauthAccount.user);
        }

        // 2. Check if a User with this email already exists (e.g. registered via email/password)
        let existingUser = await prisma.user.findUnique({
            where: { email },
            include: { oauthAccounts: true },
        });

        if (existingUser) {
            await prisma.oAuthAccount.create({
                data: {
                    userId: existingUser.id,
                    provider: 'google',
                    providerId: profile.id,
                    email,
                    name: profile.displayName,
                    avatar: profile.photos?.[0]?.value ?? null,
                },
            });
            return done(null, existingUser);
        }

        // 3. New User Registration: create User, OAuthAccount, and Account atomically
        const nameParts = profile.displayName ? profile.displayName.split(' ') : [];
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const createdUser = await prisma.$transaction(async (tx) => {
            // Guard against concurrent callbacks during retries
            const concurrentUser = await tx.user.findUnique({
                where: { email },
                include: { oauthAccounts: true },
            });

            if (concurrentUser) {
                const alreadyLinked = concurrentUser.oauthAccounts?.some(
                    (a) => a.provider === 'google' && a.providerId === profile.id
                );
                if (!alreadyLinked) {
                    await tx.oAuthAccount.create({
                        data: {
                            userId: concurrentUser.id,
                            provider: 'google',
                            providerId: profile.id,
                            email,
                            name: profile.displayName,
                            avatar: profile.photos?.[0]?.value ?? null,
                        },
                    });
                }
                return concurrentUser;
            }

            const newUser = await tx.user.create({
                data: {
                    email,
                    emailVerified: true,
                    emailVerifiedAt: new Date(),
                    firstName,
                    lastName,
                    avatar: profile.photos?.[0]?.value ?? null,
                    oauthAccounts: {
                        create: {
                            provider: 'google',
                            providerId: profile.id,
                            email,
                            name: profile.displayName,
                            avatar: profile.photos?.[0]?.value ?? null,
                        },
                    },
                },
            });

            // Provision checking account with secure account number and collision retry
            let attempts = 0;
            let accountCreated = false;

            while (attempts < 3 && !accountCreated) {
                try {
                    attempts++;
                    await tx.account.create({
                        data: {
                            userId: newUser.id,
                            accountNumber: generateAccountNumber(),
                            type: 'CHECKING',
                            status: 'ACTIVE',
                            balance: new Prisma.Decimal('1000.00'),
                            currency: 'INR',
                        },
                    });
                    accountCreated = true;
                } catch (error: any) {
                    const isCollision =
                        error.code === 'P2002' &&
                        (Array.isArray(error.meta?.target)
                            ? error.meta.target.includes('accountNumber')
                            : error.meta?.target === 'accountNumber');

                    if (isCollision) {
                        if (attempts < 3) continue;
                        break;
                    }
                    throw error;
                }
            }

            if (!accountCreated) {
                throw new AppError('Account creation failed, please try again', 500);
            }

            return newUser;
        });

        await AuditLogger.log({
            userId: createdUser.id,
            action: 'ACCOUNT_CREATED',
            resource: 'ACCOUNT',
            metadata: {
                email: createdUser.email,
                provider: 'google',
            },
        });

        try {
            await EmailService.sendWelcomeEmail(email, firstName);
        } catch {
            // Non-critical: failure to send welcome email shouldn't block login
        }

        return done(null, createdUser);
    } catch (error) {
        return done(error as Error);
    }
};

passport.use(
    new GoogleStrategy(
        {
            clientID: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            callbackURL: env.GOOGLE_CALLBACK_URL,
        },
        handleGoogleAuth
    )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;