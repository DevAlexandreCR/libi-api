import { Router } from 'express'
import { requireAuth, requireMerchantAccess } from '../../middleware/auth'
import { getSessionDetail, listSessions } from './session.service'
import { prisma } from '../../prisma/client'
import { forbidden } from '../../utils/errors'

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

export default router
