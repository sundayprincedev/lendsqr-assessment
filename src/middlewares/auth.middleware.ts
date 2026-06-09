import { NextFunction, Request, Response } from 'express';
import { ErrorCode } from '../config/constants';
import { env } from '../config/env';
import { extractUserIdFromToken } from '../utils/auth.token';
import { AppError } from '../utils/AppError';

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    next(new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED));
    return;
  }

  const token = authorization.slice('Bearer '.length).trim();
  const userId = extractUserIdFromToken(token, env.authSecret);

  if (!userId) {
    next(new AppError('Invalid authentication token', 401, ErrorCode.UNAUTHORIZED));
    return;
  }

  req.user = { id: userId };
  next();
}
