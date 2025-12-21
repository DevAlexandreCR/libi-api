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

  const newSession = await prisma.session.create({
    data: {
      merchantId,
      whatsappLineId,
      customerPhone,
      status: SessionStatus.NEW,
      state: {},
      lastInteractionAt: now,
    },
  })

  // Emit SSE event for new session
  broadcastSSE(merchantId, {
    type: 'session_created',
    data: {
      id: newSession.id,
      merchantId: newSession.merchantId,
      customerPhone: newSession.customerPhone,
      status: newSession.status,
      isManualMode: newSession.isManualMode,
      createdAt: newSession.createdAt,
      lastInteractionAt: newSession.lastInteractionAt,
    },
  })

  return newSession
}

export async function appendSessionMessage(
  sessionId: string,
  role: MessageRole,
  content: string,
  whatsappMessageId?: string
) {
  // Si hay whatsappMessageId, verificar si ya existe
  if (whatsappMessageId) {
    const existing = await prisma.sessionMessage.findFirst({
      where: { whatsappMessageId },
    })
    if (existing) {
      console.log('[appendSessionMessage] Message already exists, skipping:', whatsappMessageId)
      return existing
    }
  }

  return prisma.sessionMessage.create({
    data: { sessionId, role, content, whatsappMessageId },
  })
}

export async function updateSessionState(
  sessionId: string,
  state: Prisma.InputJsonValue,
  status?: SessionStatus
) {
  const updated = await prisma.session.update({
    where: { id: sessionId },
    data: {
      state,
      status,
      lastInteractionAt: new Date(),
    },
  })

  // Emit SSE event for session update (without full state/messages)
  broadcastSSE(updated.merchantId, {
    type: 'session_updated',
    data: {
      id: updated.id,
      merchantId: updated.merchantId,
      status: updated.status,
      isManualMode: updated.isManualMode,
      lastInteractionAt: updated.lastInteractionAt,
      updatedAt: new Date(),
    },
  })

  return updated
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
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 50,
      },
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
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
