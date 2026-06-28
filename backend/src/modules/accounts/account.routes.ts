import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { AccountController } from './account.controller.js';

const router = Router();


router.use(requireAuth);


/**
 * @swagger
 * /api/v1/accounts:
 *   get:
 *     summary: Get user accounts
 *     tags:
 *       - Accounts
 * 
 *     security:
 *       - bearerAuth: []
 *     
 *     responses:
 *       200:
 *         description: User accounts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AccountsResponse'
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
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalServerError'
 */
router.get('/', AccountController.getMyAccounts);


/**
 * @swagger
 * /api/v1/accounts/{accountId}:
 *   get:
 *     summary: Get account details
 *     tags:
 *       - Accounts
 * 
 *     security:
 *       - bearerAuth: []
 *     
 *     responses:
 *       200:
 *         description: Account details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Account'
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
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalServerError'
 */
router.get('/:accountId', AccountController.getAccountDetails);


export default router;