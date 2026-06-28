import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { AccountController } from './account.controller.js';

const router = Router();


router.use(requireAuth);

router.get('/', AccountController.getMyAccounts);
router.get('/:accountId', AccountController.getAccountDetails);

export default router;