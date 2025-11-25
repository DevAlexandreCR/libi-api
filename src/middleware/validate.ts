import { AnyZodObject } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { badRequest } from '../utils/errors';

export function validate(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query
    });

    if (!result.success) {
      return next(badRequest('Validation error', result.error.flatten()));
    }

    Object.assign(req, result.data);
    return next();
  };
}
