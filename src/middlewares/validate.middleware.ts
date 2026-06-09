import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { ErrorCode } from '../config/constants';
import { AppError } from '../utils/AppError';

type RequestProperty = 'body' | 'query' | 'params';

export function validate(schema: Joi.ObjectSchema, property: RequestProperty = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const message = error.details.map((detail) => detail.message).join(', ');
      next(new AppError(message, 422, ErrorCode.VALIDATION_ERROR));
      return;
    }

    req[property] = value;
    next();
  };
}
