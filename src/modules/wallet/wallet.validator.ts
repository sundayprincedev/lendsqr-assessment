import Joi from 'joi';

const amountSchema = Joi.number().positive().precision(2).required();
const referenceSchema = Joi.string().trim().min(1).max(100).required();

export const fundSchema = Joi.object({
  amount: amountSchema,
  reference: referenceSchema,
});

export const transferSchema = Joi.object({
  recipient_email: Joi.string().trim().email().required(),
  amount: amountSchema,
  reference: referenceSchema,
});

export const withdrawSchema = Joi.object({
  amount: amountSchema,
  reference: referenceSchema,
});
