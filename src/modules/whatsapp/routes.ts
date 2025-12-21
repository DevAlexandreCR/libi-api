import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireMerchantAccess } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import {
  completeEmbeddedSignup,
  createWhatsAppLine,
  listWhatsAppLines,
  updateWhatsAppLine,
  toggleBotEnabled,
} from './whatsapp.service'
import { verifyWebhook, handleWebhook } from './webhook'
import { WhatsAppLineStatus, DayOfWeek } from '@prisma/client'
import {
  getBusinessHours,
  upsertBusinessHours,
  checkBusinessHoursStatus,
} from './businessHours.service'

const router = Router()

router.get('/webhooks/whatsapp', verifyWebhook)
router.post('/webhooks/whatsapp', handleWebhook)

router.get(
  '/merchants/:merchantId/whatsapp-lines',
  requireAuth,
  requireMerchantAccess(),
  async (req, res, next) => {
    try {
      const lines = await listWhatsAppLines(req.params.merchantId)
      res.json(lines)
    } catch (err) {
      next(err)
    }
  }
)

router.post(
  '/merchants/:merchantId/whatsapp-lines',
  requireAuth,
  requireMerchantAccess(),
  async (req, res, next) => {
    try {
      const line = await createWhatsAppLine(req.params.merchantId, req.body)
      res.status(201).json(line)
    } catch (err) {
      next(err)
    }
  }
)

router.post(
  '/merchants/:merchantId/whatsapp-lines/embedded-signup/complete',
  requireAuth,
  requireMerchantAccess(),
  validate(
    z.object({
      body: z.object({
        access_token: z.string(),
        phone_number_id: z.string(),
        waba_id: z.string(),
        business_id: z.string().optional(),
        phone_number: z.string().optional(),
        phone_display_name: z.string().optional(),
      }),
    })
  ),
  async (req, res, next) => {
    try {
      const line = await completeEmbeddedSignup(req.params.merchantId, req.body)
      res.json(line)
    } catch (err) {
      next(err)
    }
  }
)

router.put(
  '/whatsapp-lines/:lineId',
  requireAuth,
  validate(
    z.object({
      body: z.object({
        status: z.nativeEnum(WhatsAppLineStatus).optional(),
        phoneDisplayName: z.string().optional(),
      }),
    })
  ),
  async (req, res, next) => {
    try {
      const line = await updateWhatsAppLine(req.params.lineId, req.body)
      res.json(line)
    } catch (err) {
      next(err)
    }
  }
)

// Toggle bot enabled/disabled
router.patch(
  '/whatsapp-lines/:lineId/bot-enabled',
  requireAuth,
  validate(
    z.object({
      body: z.object({
        botEnabled: z.boolean(),
      }),
    })
  ),
  async (req, res, next) => {
    try {
      const line = await toggleBotEnabled(req.params.lineId, req.body.botEnabled)
      res.json(line)
    } catch (err) {
      next(err)
    }
  }
)

// Get business hours
router.get(
  '/merchants/:merchantId/business-hours',
  requireAuth,
  requireMerchantAccess(),
  async (req, res, next) => {
    try {
      const hours = await getBusinessHours(req.params.merchantId)
      res.json(hours)
    } catch (err) {
      next(err)
    }
  }
)

// Update business hours
router.put(
  '/merchants/:merchantId/business-hours',
  requireAuth,
  requireMerchantAccess(),
  validate(
    z.object({
      body: z.array(
        z.object({
          dayOfWeek: z.nativeEnum(DayOfWeek),
          isEnabled: z.boolean(),
          openTime: z.string().regex(/^\d{2}:\d{2}$/),
          closeTime: z.string().regex(/^\d{2}:\d{2}$/),
          crossesMidnight: z.boolean(),
        })
      ),
    })
  ),
  async (req, res, next) => {
    try {
      await upsertBusinessHours(req.params.merchantId, req.body)
      const hours = await getBusinessHours(req.params.merchantId)
      res.json(hours)
    } catch (err) {
      next(err)
    }
  }
)

// Check business hours status
router.get(
  '/merchants/:merchantId/business-hours/status',
  requireAuth,
  requireMerchantAccess(),
  async (req, res, next) => {
    try {
      const status = await checkBusinessHoursStatus(req.params.merchantId)
      res.json(status)
    } catch (err) {
      next(err)
    }
  }
)

export default router
