import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { TransactionController } from './transaction.controller.js';
import { validate } from '../../middleware/validate.js';
import { transferSchema } from './transaction.schema.js';

const router = Router();


router.use(requireAuth);


router.post('/transfer', validate(transferSchema), TransactionController.transfer);


export default router;