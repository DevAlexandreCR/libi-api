import { Router } from 'express'
import { requireAuth, requireMerchantAccess } from '../../middleware/auth'
import { getSessionDetail, listSessions, toggleManualMode, sendManualMessage } from './session.service'
import { prisma } from '../../prisma/client'
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

router.patch('/sessions/:sessionId/manual-mode', requireAuth, async (req, res, next) => {
  try {
    const session = await getSessionDetail(req.params.sessionId)
    if (req.user?.merchantId && session.merchantId !== req.user.merchantId) {
      return next(forbidden())
    }
    
    const { isManualMode } = req.body
    if (typeof isManualMode !== 'boolean') {
      return next(badRequest('isManualMode must be a boolean'))
    }
    
    const updated = await toggleManualMode(req.params.sessionId, isManualMode)
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
    if (!message || typeof message !== 'string') {
      return next(badRequest('message is required and must be a string'))
    }
    
    const data = await sendManualMessage(req.params.sessionId, message)
    
    // Send WhatsApp message
    await sendWhatsAppText(data.lineId, data.customerPhone, message)
    
    // Save message to session history
    await appendSessionMessage(req.params.sessionId, MessageRole.assistant, message)
    
    res.json({ success: true, message: 'Message sent' })
  } catch (err) {
    next(err)
  }
})

export default router
