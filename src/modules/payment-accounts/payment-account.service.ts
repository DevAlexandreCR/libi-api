import { PaymentAccountType } from '@prisma/client'
import { prisma } from '../../prisma/client'
import { notFound } from '../../utils/errors'

export type CreatePaymentAccountInput = {
  type: PaymentAccountType
  accountNumber: string
  accountHolder: string
  bankName?: string
  description?: string
  isActive?: boolean
}

export type UpdatePaymentAccountInput = Partial<CreatePaymentAccountInput>

export async function createPaymentAccount(merchantId: string, data: CreatePaymentAccountInput) {
  return prisma.paymentAccount.create({
    data: {
      merchantId,
      ...data,
    },
  })
}

export async function listPaymentAccounts(merchantId: string, activeOnly = false) {
  return prisma.paymentAccount.findMany({
    where: {
      merchantId,
      ...(activeOnly ? { isActive: true } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getPaymentAccountById(id: string) {
  const account = await prisma.paymentAccount.findUnique({
    where: { id },
    include: { merchant: true },
  })
  if (!account) throw notFound('Payment account not found')
  return account
}

export async function updatePaymentAccount(id: string, data: UpdatePaymentAccountInput) {
  await getPaymentAccountById(id)
  return prisma.paymentAccount.update({
    where: { id },
    data,
  })
}

export async function deletePaymentAccount(id: string) {
  await getPaymentAccountById(id)
  return prisma.paymentAccount.delete({ where: { id } })
}
