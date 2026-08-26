import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { TransactionController } from './transaction.controller.js';
import { validate } from '../../middleware/validate.js';
import { transferSchema, getTransactionsSchema } from './transaction.schema.js';

const router = Router();


router.use(requireAuth);


/**
 * @swagger
 * /api/v1/transactions/transfer:
 *   post:
 *     summary: Transfer funds between accounts
 *     tags:
 *       - Transactions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromAccountId
 *               - toAccountId
 *               - amount
 *               - description
 *               - reference
 *             properties:
 *               fromAccountId:
 *                 type: string
 *                 example: '64b8c9f1e4b0a2d3c4e5f678'
 *               toAccountId:
 *                 type: string
 *                 example: '64b8c9f1e4b0a2d3c4e5f678'
 *               amount:
 *                 type: string
 *                 example: '1000.00'
 *               description:
 *                 type: string
 *                 example: 'Transfer funds'
 *               reference:
 *                 type: string
 *                 example: '123456789'
 *     responses:
 *       200:
 *         description: Funds transferred successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transaction'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Unauthorized
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Insufficient funds
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalServerError'
 */
router.post('/transfer', validate(transferSchema), TransactionController.transfer);


/**
 * @swagger
 * /api/v1/transactions/history:
 *   get:
 *     summary: Get transaction history for an account
 *     tags:
 *       - Transactions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Transaction history
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TransactionHistory'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Unauthorized
 *      404:
 *         description: Account not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:    
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Account not found
 *      500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalServerError'
 */
router.get('/history', validate(getTransactionsSchema), TransactionController.getHistory);


export default router;