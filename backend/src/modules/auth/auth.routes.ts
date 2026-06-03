import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { registerSchema, loginSchema } from './auth.schema.js';


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
router.post('/register', validate(registerSchema), AuthController.register);


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
router.post('/login', validate(loginSchema), AuthController.login);


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


export default router;