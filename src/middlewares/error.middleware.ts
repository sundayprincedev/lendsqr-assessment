import { NextFunction, Request, Response } from 'express';
import { ErrorCode } from '../config/constants';
import { AppError } from '../utils/AppError';
import { sendError } from '../utils/response.helper';

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): Response {
  if (err instanceof AppError) {
    return sendError(res, err.message, err.errorCode, err.statusCode);
  }

  return sendError(
    res,
    'An unexpected error occurred',
    ErrorCode.INTERNAL_ERROR,
    500,
  );
}

export function notFoundMiddleware(
  _req: Request,
  res: Response,
): Response {
  return sendError(
    res,
    'Endpoint not found',
    ErrorCode.NOT_FOUND,
    404,
  );
}
