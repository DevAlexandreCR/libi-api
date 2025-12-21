import { Prisma } from '@prisma/client'
import { prisma } from '../../prisma/client'
import { notFound } from '../../utils/errors'

export type MerchantInput = {
  name: string
  slug: string
  description?: string
  address?: string
  phone?: string
  timezone?: string
}

export async function listMerchants(search?: string) {
  const where: Prisma.MerchantWhereInput = search
    ? {
      OR: [
        { name: { contains: search } },
        { slug: { contains: search } },
      ],
    }
    : {}
  return prisma.merchant.findMany({
    where,
    include: {
      whatsappLines: true,
      orders: { select: { id: true } },
      menus: { select: { id: true, isActive: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createMerchant(data: MerchantInput) {
  return prisma.merchant.create({ data })
}

export async function getMerchant(id: string) {
  const merchant = await prisma.merchant.findUnique({ where: { id } })
  if (!merchant) throw notFound('Merchant not found')
  return merchant
}

export async function updateMerchant(id: string, data: Partial<MerchantInput>) {
  await getMerchant(id)
  return prisma.merchant.update({ where: { id }, data })
}

export async function deleteMerchant(id: string) {
  await getMerchant(id)
  return prisma.merchant.delete({ where: { id } })
}
