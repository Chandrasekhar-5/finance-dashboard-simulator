import { Resend } from 'resend';
import { env } from '../config/env.js';


const resend = new Resend(env.RESEND_API_KEY);

export const EmailService = {
    async sendVeificationEmail(to: string, token: string) {
        const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${token}`;

        try {
            await resend.emails.send({
                from: env.EMAIL_FROM,
                to,
                subject: 'Verify your email address',
                html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify Your Email</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { text-align: center; padding: 20px 0; background: #f8f9fa; border-radius: 8px; }
              .content { padding: 30px 0; }
              .button { display: inline-block; padding: 12px 24px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px 0; font-size: 12px; color: #666; border-top: 1px solid #eee; }
              .code { background: #f4f4f4; padding: 10px; font-size: 20px; letter-spacing: 2px; text-align: center; font-family: monospace; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to Our Banking App!</h1>
              </div>
              <div class="content">
                <p>Hi there,</p>
                <p>Thanks for signing up! Please verify your email address to get started with your banking journey.</p>
                <div style="text-align: center;">
                  <a href="${verificationUrl}" class="button">Verify Email Address</a>
                </div>
                <p>Or copy and paste this link:</p>
                <div class="code">${verificationUrl}</div>
                <p>This link will expire in 24 hours.</p>
                <p>If you didn't create an account, you can safely ignore this email.</p>
              </div>
              <div class="footer">
                <p>Secure Banking App - Your money, our priority</p>
              </div>
            </div>
          </body>
          </html>
        `, 
            });

            console.log(`Verification email sent to ${to}`);
        } catch (error) {
            console.error('Failed to send verification email:', error);
            throw new Error('Failed to send verification email');
        }
    },

    async sendPasswordResetEmail(to: string, token: string) {
        const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;

        try {
            await resend.emails.send({
                from: env.EMAIL_FROM,
                to,
                subject: 'Reset your password',
                html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Reset Your Password</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .button { display: inline-block; padding: 12px 24px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>Reset Your Password</h2>
              <p>We received a request to reset your password. Click the button below to create a new password:</p>
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              <p>This link will expire in 1 hour.</p>
              <p>If you didn't request this, please ignore this email.</p>
            </div>
          </body>
          </html>
        `,
            });

            console.log(`Password reset email sent to ${to}`);
        } catch (error) {
            console.error('Failed to send password reset email:', error);
            throw new Error('Failed to send password reset email');
        }
    },

    async sendWelcomeEmail(to: string, firstName: string) {
        try {
            await resend.emails.send({
                from: env.EMAIL_FROM,
                to,
                subject: 'Welcome to our Banking App!',
                html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Welcome!</title>
          </head>
          <body>
            <div class="container">
              <h2>Welcome ${firstName}!</h2>
              <p>Thank you for joining our banking app. We're excited to help you manage your finances.</p>
              <p>Here's what you can do next:</p>
              <ul>
                <li>Complete your profile</li>
                <li>Link your bank accounts</li>
                <li>Set up beneficiaries</li>
                <li>Start making transactions</li>
              </ul>
              <p>If you have any questions, our support team is here to help.</p>
            </div>
          </body>
          </html>
        `,
            });
        } catch (error) {
            console.error('Failed to send welcome email:', error);
        }
    }
}