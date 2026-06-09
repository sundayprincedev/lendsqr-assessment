import { ErrorCode } from '../config/constants';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ErrorCode;

  constructor(message: string, statusCode: number, errorCode: ErrorCode) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}
