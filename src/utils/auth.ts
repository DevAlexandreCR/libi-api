import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey'

export interface AuthRequest extends Request {
  userId?: string
  userType?: 'admin' | 'business'
}

export const generateToken = (userId: string, userType: 'admin' | 'business'): string => {
  return jwt.sign({ userId, userType }, JWT_SECRET, { expiresIn: '7d' })
}

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; userType: 'admin' | 'business' }
    req.userId = decoded.userId
    req.userType = decoded.userType
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}
