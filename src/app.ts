import express, { Application, Request, Response } from 'express';
import { API_PREFIX } from './config/constants';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.middleware';
import userRoutes from './modules/users/user.routes';
import walletRoutes from './modules/wallet/wallet.routes';
import { sendSuccess } from './utils/response.helper';

export function createApp(): Application {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  app.get(API_PREFIX, (_req: Request, res: Response) => {
    return sendSuccess(res, {
      service: 'Demo Credit Wallet API',
      version: API_PREFIX.replace('/api/', ''),
    });
  });

  app.use(`${API_PREFIX}/auth`, userRoutes);
  app.use(`${API_PREFIX}/wallet`, walletRoutes);
  app.use(notFoundMiddleware);

  app.use(errorMiddleware);

  return app;
}
