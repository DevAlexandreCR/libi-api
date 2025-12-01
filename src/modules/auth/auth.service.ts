import jwt from 'jsonwebtoken'
import { prisma } from '../../prisma/client'
import { comparePassword } from '../../utils/password'
import { config } from '../../config/env'
import { unauthorized } from '../../utils/errors'
import { UserRole } from '@prisma/client'

export type LoginResult = {
  token: string
  user: {
    id: string
    email: string
    role: UserRole
    merchantId?: string | null
  }
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw unauthorized('Invalid credentials')

  const valid = await comparePassword(password, user.passwordHash)
  if (!valid) throw unauthorized('Invalid credentials')

  const payload = { id: user.id, role: user.role, merchantId: user.merchantId }
  const token = jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN })

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      merchantId: user.merchantId,
    },
  }
}
