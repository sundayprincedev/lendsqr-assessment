import { Response } from 'express';
import { ErrorCode } from '../config/constants';

interface SuccessResponse<T> {
  status: 'success';
  message?: string;
  data: T;
}

interface ErrorResponse {
  status: 'error';
  message: string;
  error: string;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
): Response<SuccessResponse<T>> {
  const body: SuccessResponse<T> = {
    status: 'success',
    data,
  };

  if (message) {
    body.message = message;
  }

  return res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  message: string,
  errorCode: ErrorCode,
  statusCode: number,
): Response<ErrorResponse> {
  return res.status(statusCode).json({
    status: 'error',
    message,
    error: errorCode,
  });
}
