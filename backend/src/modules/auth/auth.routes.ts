import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema, resendVerificationEmail } from './auth.schema.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { registerLimiter, loginLimiter, refreshLimiter, forgotPasswordLimiter, changePasswordLimiter } from '../../middleware/rateLimiter.js';
import { requireEmailVerified } from '../../middleware/requireEmailVerification.js';


const router = Router();

/**
 * @swagger
 * /api/v1/auth/verify-email/resend:
 *   post:
 *     summary: Resend verification email
 *     tags:
 *       - Authentication
 * 
 *     requestBody:
 *       required: true
 * 
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 * 
 *             required:
 *               - email
 * 
 *             properties:
 *               email:
 *                 type: string
 *                 example: udayagiriamaresh13@gmail.com
 * 
 *     responses:
 *       200:
 *         description: Verification email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 * 
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 * 
 *                 message:
 *                   type: string
 *                   example: If an account with that email exists and is not verified, a new verification link has been sent
 * 
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 * 
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/verify-email/resend', registerLimiter, validate(resendVerificationEmail), AuthController.resendVerification);


/**
 * @swagger
 * /api/v1/auth/verify-email:
 *   get:
 *     summary: Verify user's email
 *     tags:
 *       - Authentication
 * 
 *     security:
 *       - bearerAuth: []
 * 
 *     responses:
 *       200:
 *         description: User's email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 * 
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 * 
 *                 message:
 *                   type: string
 *                   example: Email verified successfully. You can now login.
 * 
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 * 
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/verify-email', AuthController.verifyEmail);


router.post('/verify-email', validate(resendVerificationEmail), AuthController.verifyEmail);


/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags:
 *       - Authentication
 * 
 *     requestBody:
 *       required: true
 * 
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 * 
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - password
 * 
 *             properties:
 * 
 *               firstName:
 *                 type: string
 *                 example: Amaresh
 * 
 *               lastName:
 *                 type: string
 *                 example: Udayagiri
 * 
 *               email:
 *                 type: string
 *                 example: udayagiriamaresh13@gmail.com
 * 
 *               password:
 *                 type: string
 *                 example: Password123
 * 
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 * 
 *       409:
 *         description: Email already in use
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *           
 *               properties:
 *                 success:
 *                    type: boolean
 *                    example: false
 * 
 *                 error:
 *                   type: string
 *                   example: Email already in use
 * 
 * 
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/register', registerLimiter, validate(registerSchema), AuthController.register);


/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login a user
 *     tags:
 *       - Authentication
 * 
 *     requestBody:
 *       required: true
 * 
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 * 
 *             required:
 *               - email
 *               - password
 * 
 *             properties:
 *               email:
 *                 type: string
 *                 example: udayagiriamaresh13@gmail.com
 * 
 *               password:
 *                 type: string
 *                 example: Password123
 * 
 *     responses:
 *       200:
 *         description: User Logged in successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 * 
 *       401:
 *         description: Invalid email or password
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 * 
 *                 error:
 *                   type: string
 *                   example: Invalid email or password
 * 
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/login', loginLimiter, validate(loginSchema), AuthController.login);


/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout a user
 *     tags:
 *       - Authentication
 * 
 *     responses:
 *       200:
 *         description: User Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 * 
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 * 
 *                 message:
 *                   type: string
 *                   example: Logged out successfully
 * 
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/logout', AuthController.logout);


/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh a user's access token
 *     tags:
 *       - Authentication
 * 
 *     responses:
 *       200:
 *         description: User's access token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 * 
 *       401:
 *         description: Invalid or expired refresh token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 * 
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 * 
 *                 error:
 *                   type: string
 *                   example: Invalid or expired refresh token
 * 
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/refresh', refreshLimiter, AuthController.refresh);


/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current user
 *     tags:
 *       - Authentication
 * 
 *     security:
 *       - bearerAuth: []
 * 
 *     responses:
 *       200:
 *         description: Current user details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 * 
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 * 
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 * 
 *                 error:
 *                   type: string
 *                   example: Unauthorized
 * 
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/me', requireAuth, requireEmailVerified, AuthController.getme);


/**
 * @swagger
 * /api/v1/auth/logout-all:
 *   post:
 *     summary: Logout all devices
 *     tags:
 *       - Authentication
 * 
 *     security:
 *       - bearerAuth: []
 * 
 *     responses:
 *       200:
 *         description: Logged out from all devices successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 * 
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 * 
 *                 message:
 *                   type: string
 *                   example: Logged out from all devices successfully
 * 
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 * 
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 * 
 *                 error:
 *                   type: string
 *                   example: Unauthorized
 * 
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/logout-all', requireAuth, requireEmailVerified, AuthController.logoutAllDevices);


/**
 * @swagger
 * /api/v1/auth/sessions:
 *   get:
 *     summary: Get user sessions
 *     tags:
 *       - Authentication
 * 
 *     security:
 *       - bearerAuth: []
 * 
 *     responses:
 *       200:
 *         description: User sessions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionsResponse'
 * 
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 * 
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 * 
 *                 error:
 *                   type: string
 *                   example: Unauthorized
 * 
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/sessions', requireAuth, requireEmailVerified, AuthController.getSessions);


/**
 * @swagger
 * /api/v1/auth/sessions/{sessionId}:
 *   delete:
 *     summary: Revoke a user session
 *     tags:
 *       - Authentication
 * 
 *     security:
 *       - bearerAuth: []
 * 
 *     responses:
 *       200:
 *         description: Session revoked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 * 
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 * 
 *                 message:
 *                   type: string
 *                   example: Session revoked successfully
 * 
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 * 
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 * 
 *                 error:
 *                   type: string
 *                   example: Unauthorized
 * 
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/sessions/:sessionId', requireAuth, requireEmailVerified, AuthController.revokeSession);


/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Forgot password
 *     tags:
 *       - Authentication
 * 
 *     requestBody:
 *       required: true
 * 
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 * 
 *             required:
 *               - email
 * 
 *             properties:
 *               email:
 *                 type: string
 *                 example: udayagiriamaresh13@gmail.com
 * 
 *     responses:
 *       200:
 *         description: Password reset instructions sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Response'
 * 
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 * 
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), AuthController.forgotPassword);


/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Reset password
 *     tags:
 *       - Authentication
 * 
 *     requestBody:
 *       required: true
 * 
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 * 
 *             required:
 *               - token
 *               - password
 * 
 *             properties:
 *               token:
 *                 type: string
 *                 example: 64b8c9f1e4b0a2d3c4e5f678
 * 
 *               password:
 *                 type: string
 *                 example: Password123
 * 
 *     responses:
 *       200:
 *         description: Password reset successfully. Please login with your new password.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Response'
 * 
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 * 
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/reset-password', validate(resetPasswordSchema), AuthController.resetPassword);


/**
 * @swagger
 * /api/v1/auth/change-password:
 *   post:
 *     summary: Change password
 *     tags:
 *       - Authentication
 * 
 *     security:
 *       - bearerAuth: []
 * 
 *     requestBody:
 *       required: true
 * 
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 * 
 *             required:
 *               - password
 * 
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: Password123
 * 
 *               newPassword:
 *                 type: string
 *                 example: Password@1234
 * 
 *     responses:
 *       200:
 *         description: Password changed successfully. Please login again with your new password.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Response'
 * 
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 * 
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/change-password', requireAuth, requireEmailVerified, changePasswordLimiter, validate(changePasswordSchema), AuthController.changePassword);

export default router;