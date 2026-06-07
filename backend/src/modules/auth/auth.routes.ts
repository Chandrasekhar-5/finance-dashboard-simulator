import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { registerSchema, loginSchema } from './auth.schema.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { registerLimiter, loginLimiter, refreshLimiter, forgotPasswordLimiter, changePasswordLimiter } from '../../middleware/rateLimiter.js';


const router = Router();


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
router.get('/me', requireAuth, AuthController.getme);


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
router.post('/logout-all', requireAuth, AuthController.logoutAllDevices);


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
router.get('/sessions', requireAuth, AuthController.getSessions);


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
router.delete('/sessions/:sessionId', requireAuth, AuthController.revokeSession);

export default router;