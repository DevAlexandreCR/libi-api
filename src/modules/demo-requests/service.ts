import { DemoRequestStatus } from '@prisma/client'
import { prisma } from '../../prisma/client'
import { notFound } from '../../utils/errors'

export type DemoRequestInput = {
  name: string
  email: string
  phone?: string
  company?: string
  message?: string
  source?: string
}

export async function createDemoRequest(input: DemoRequestInput) {
  return prisma.demoRequest.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      company: input.company,
      message: input.message,
      source: input.source || 'landing',
    },
  })
}

export async function listDemoRequests(filter?: { status?: DemoRequestStatus }) {
  return prisma.demoRequest.findMany({
    where: {
      status: filter?.status,
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function updateDemoRequest(id: string, data: { status?: DemoRequestStatus }) {
  const existing = await prisma.demoRequest.findUnique({ where: { id } })
  if (!existing) throw notFound('Demo request not found')

  return prisma.demoRequest.update({
    where: { id },
    data: {
      status: data.status ?? existing.status,
    },
  })
}
