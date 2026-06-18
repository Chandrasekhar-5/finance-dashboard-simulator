import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from '../lib//prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { EmailService } from '../services/email.service.js';


passport.use(
    new GoogleStrategy(
        {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
        },

        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value;
                if (!email) {
                    return done(new AppError('No email found from Google', 400));
                }

                let existingUser = await prisma.user.findUnique({
                    where: { email },
                    include: { oauthAccounts: true },
                });

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
                            where: { id: oauthAccount.id, },
                            data: {
                                name: profile.displayName,
                                avatar: profile.photos?.[0]?.value ?? null,
                                email,
                            },
                        }),

                        prisma.user.update({
                            where: { id: oauthAccount.user.id, },
                            data: {
                                avatar: profile.photos?.[0]?.value ?? null,
                            },
                        }),
                    ]);

                    return done(null, oauthAccount.user);
                }

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

                const nameParts = profile.displayName.split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';

                const newUser = await prisma.user.create({
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

                await EmailService.sendWelcomeEmail(email, firstName);

                return done(null, newUser);
            } catch (error) {
                return done(error as Error);
            }
        }
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