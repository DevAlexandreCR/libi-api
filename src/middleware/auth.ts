import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { UserRole } from '@prisma/client'
import { config } from '../config/env'
import { unauthorized, forbidden } from '../utils/errors'

export type AuthUser = {
  id: string
  role: UserRole
  merchantId?: string | null
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  let token: string | undefined

  if (header?.startsWith('Bearer ')) {
    token = header.replace('Bearer ', '')
  } else if (typeof req.query.token === 'string') {
    token = req.query.token
  }

  if (!token) {
    return next(unauthorized())
  }
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as AuthUser
    req.user = payload
    return next()
  } catch (err) {
    return next(unauthorized())
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized())
    if (!roles.includes(req.user.role)) {
      return next(forbidden())
    }
    return next()
  }
}

export function requireMerchantAccess(paramKey = 'merchantId') {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized())
    if (req.user.role === UserRole.SUPER_ADMIN) return next()
    const merchantId = req.params[paramKey] || req.user.merchantId
    if (!merchantId || merchantId !== req.user.merchantId) {
      return next(forbidden('Merchant access denied'))
    }
    return next()
  }
}
