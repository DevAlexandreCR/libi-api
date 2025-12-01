import { NextFunction, Request, Response } from 'express'
import { ApiError } from '../utils/errors'
import { logger } from '../utils/logger'

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    logger.warn({ err }, 'Handled API error')
    return res.status(err.status).json({ message: err.message, details: err.details })
  }

  logger.error({ err }, 'Unhandled error')
  return res.status(500).json({ message: 'Internal server error' })
}
