import { Router } from 'express'
import { requireAuth, requireMerchantAccess } from '../../middleware/auth'
import { getSessionDetail, listSessions, toggleManualMode, sendManualMessage } from './session.service'
import { forbidden, badRequest } from '../../utils/errors'
import { sendWhatsAppText } from '../whatsapp/whatsapp.service'
import { MessageRole } from '@prisma/client'
import { appendSessionMessage } from './session.service'

const router = Router()

router.get(
  '/merchants/:merchantId/sessions',
  requireAuth,
  requireMerchantAccess(),
  async (req, res, next) => {
    try {
      const sessions = await listSessions(req.params.merchantId)
      res.json(sessions)
    } catch (err) {
      next(err)
    }
  }
)

router.get('/sessions/:sessionId', requireAuth, async (req, res, next) => {
  try {
    const session = await getSessionDetail(req.params.sessionId)
    if (req.user?.merchantId && session.merchantId !== req.user.merchantId) {
      return next(forbidden())
    }
    res.json(session)
  } catch (err) {
    next(err)
  }
})

router.post('/sessions/:sessionId/pause', requireAuth, async (req, res, next) => {
  try {
    const session = await getSessionDetail(req.params.sessionId)
    if (req.user?.merchantId && session.merchantId !== req.user.merchantId) {
      return next(forbidden())
    }

    const updated = await toggleManualMode(req.params.sessionId, true)
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

router.post('/sessions/:sessionId/resume', requireAuth, async (req, res, next) => {
  try {
    const session = await getSessionDetail(req.params.sessionId)
    if (req.user?.merchantId && session.merchantId !== req.user.merchantId) {
      return next(forbidden())
    }

    const updated = await toggleManualMode(req.params.sessionId, false)
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

router.post('/sessions/:sessionId/send-message', requireAuth, async (req, res, next) => {
  try {
    const session = await getSessionDetail(req.params.sessionId)
    if (req.user?.merchantId && session.merchantId !== req.user.merchantId) {
      return next(forbidden())
    }

    const { message } = req.body
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return next(badRequest('message is required and must be a non-empty string'))
    }

    const data = await sendManualMessage(req.params.sessionId, message)

    // Send WhatsApp message
    const messageId = await sendWhatsAppText(data.lineId, data.customerPhone, message)

    // Save message to session history
    await appendSessionMessage(req.params.sessionId, MessageRole.assistant, message)

    res.json({ success: true, messageId })
  } catch (err) {
    next(err)
  }
})

export default router
