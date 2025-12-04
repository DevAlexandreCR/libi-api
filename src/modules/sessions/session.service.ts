import { MessageRole, SessionStatus, Prisma } from '@prisma/client'
import { prisma } from '../../prisma/client'
import { notFound } from '../../utils/errors'
import { broadcastSSE } from '../../utils/sse'

export async function findOrCreateSession(
  merchantId: string,
  whatsappLineId: string,
  customerPhone: string,
  expirationMinutes: number
) {
  const existing = await prisma.session.findFirst({
    where: {
      merchantId,
      customerPhone,
      status: { not: SessionStatus.EXPIRED },
    },
    orderBy: { createdAt: 'desc' },
  })

  const now = new Date()
  if (existing) {
    const diffMinutes = (now.getTime() - existing.lastInteractionAt.getTime()) / (1000 * 60)
    if (diffMinutes > expirationMinutes) {
      await prisma.session.update({
        where: { id: existing.id },
        data: { status: SessionStatus.EXPIRED },
      })
    } else {
      return prisma.session.update({
        where: { id: existing.id },
        data: { lastInteractionAt: now },
      })
    }
  }

  return prisma.session.create({
    data: {
      merchantId,
      whatsappLineId,
      customerPhone,
      status: SessionStatus.NEW,
      state: {},
      lastInteractionAt: now,
    },
  })
}

export async function appendSessionMessage(sessionId: string, role: MessageRole, content: string) {
  return prisma.sessionMessage.create({
    data: { sessionId, role, content },
  })
}

export async function updateSessionState(
  sessionId: string,
  state: Prisma.JsonValue,
  status?: SessionStatus
) {
  return prisma.session.update({
    where: { id: sessionId },
    data: {
      state,
      status,
      lastInteractionAt: new Date(),
    },
  })
}

export async function listSessions(merchantId: string) {
  return prisma.session.findMany({
    where: { merchantId },
    include: {
      messages: { orderBy: { createdAt: 'asc' }, take: 5 },
      orders: true,
    },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function getSessionDetail(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { messages: { orderBy: { createdAt: 'asc' } }, orders: true, merchant: true },
  })
  if (!session) throw notFound('Session not found')
  return session
}

export async function toggleManualMode(sessionId: string, isManualMode: boolean) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } })
  if (!session) throw notFound('Session not found')

  const updated = await prisma.session.update({
    where: { id: sessionId },
    data: { isManualMode },
  })

  // Emit SSE event
  broadcastSSE(session.merchantId, {
    type: 'session_manual_mode_changed',
    data: {
      sessionId: updated.id,
      manualMode: updated.isManualMode,
      customerPhone: updated.customerPhone,
    },
  })

  return updated
}

export async function sendManualMessage(sessionId: string, message: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { whatsappLine: true },
  })
  if (!session) throw notFound('Session not found')

  return {
    session,
    lineId: session.whatsappLine.id,
    customerPhone: session.customerPhone,
    message,
  }
}
