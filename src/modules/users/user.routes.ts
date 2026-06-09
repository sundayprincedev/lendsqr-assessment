import { Router } from 'express';
import { env } from '../../config/env';
import { asyncHandler } from '../../middlewares/async.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createKarmaService } from '../../utils/karma.service';
import { WalletRepository } from '../wallet/wallet.repository';
import { UserController } from './user.controller';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';
import { loginSchema, registerSchema } from './user.validator';

const userRepository = new UserRepository();
const walletRepository = new WalletRepository();
const karmaService = createKarmaService();
const userService = new UserService(
  userRepository,
  walletRepository,
  karmaService,
  env.authSecret,
);
const userController = new UserController(userService);

const router = Router();

router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(userController.register),
);

router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(userController.login),
);

export default router;
