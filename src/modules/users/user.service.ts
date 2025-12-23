import { UserRole } from '@prisma/client'
import { prisma } from '../../prisma/client'
import { badRequest, conflict, notFound } from '../../utils/errors'
import { hashPassword } from '../../utils/password'

export type CreateUserInput = {
  email: string
  password: string
  role: UserRole
  merchantId?: string
}

const baseSelect = {
  id: true,
  email: true,
  role: true,
  merchantId: true,
  createdAt: true,
  updatedAt: true,
  merchant: { select: { id: true, name: true, slug: true } },
}

export async function listUsers() {
  return prisma.user.findMany({
    select: baseSelect,
    orderBy: { createdAt: 'desc' },
  })
}

export async function createUser(input: CreateUserInput) {
  const { email, password, role, merchantId } = input

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw conflict('User with this email already exists')

  if (role === UserRole.MERCHANT_ADMIN) {
    if (!merchantId) throw badRequest('merchantId is required for merchant admins')
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } })
    if (!merchant) throw notFound('Merchant not found')
  }

  const passwordHash = await hashPassword(password)

  return prisma.user.create({
    data: {
      email,
      passwordHash,
      role,
      merchantId: role === UserRole.MERCHANT_ADMIN ? merchantId ?? null : null,
    },
    select: baseSelect,
  })
}
