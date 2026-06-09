import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../middlewares/async.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { UserRepository } from '../users/user.repository';
import { TransactionRepository } from './transaction.repository';
import { WalletController } from './wallet.controller';
import { WalletRepository } from './wallet.repository';
import { WalletService } from './wallet.service';
import { fundSchema, transferSchema, withdrawSchema } from './wallet.validator';

const walletRepository = new WalletRepository();
const transactionRepository = new TransactionRepository();
const userRepository = new UserRepository();
const walletService = new WalletService(
  walletRepository,
  transactionRepository,
  userRepository,
);
const walletController = new WalletController(walletService);

const router = Router();

router.use(authMiddleware);

router.get('/', asyncHandler(walletController.getWallet));
router.post('/fund', validate(fundSchema), asyncHandler(walletController.fund));
router.post('/transfer', validate(transferSchema), asyncHandler(walletController.transfer));
router.post('/withdraw', validate(withdrawSchema), asyncHandler(walletController.withdraw));
router.get('/balance', asyncHandler(walletController.getBalance));

export default router;
