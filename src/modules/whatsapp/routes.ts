import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireMerchantAccess } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  completeEmbeddedSignup,
  createWhatsAppLine,
  listWhatsAppLines,
  updateWhatsAppLine
} from './whatsapp.service';
import { verifyWebhook, handleWebhook } from './webhook';
import { WhatsAppLineStatus } from '@prisma/client';

const router = Router();

router.get('/webhooks/whatsapp', verifyWebhook);
router.post('/webhooks/whatsapp', handleWebhook);

router.get(
  '/merchants/:merchantId/whatsapp-lines',
  requireAuth,
  requireMerchantAccess(),
  async (req, res, next) => {
    try {
      const lines = await listWhatsAppLines(req.params.merchantId);
      res.json(lines);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/merchants/:merchantId/whatsapp-lines',
  requireAuth,
  requireMerchantAccess(),
  async (req, res, next) => {
    try {
      const line = await createWhatsAppLine(req.params.merchantId, req.body);
      res.status(201).json(line);
    } catch (err) {
      next(err);
    }
  }
);

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
        phone_display_name: z.string().optional()
      })
    })
  ),
  async (req, res, next) => {
    try {
      const line = await completeEmbeddedSignup(req.params.merchantId, req.body);
      res.json(line);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/whatsapp-lines/:lineId',
  requireAuth,
  validate(
    z.object({
      body: z.object({
        status: z.nativeEnum(WhatsAppLineStatus).optional(),
        phoneDisplayName: z.string().optional()
      })
    })
  ),
  async (req, res, next) => {
    try {
      const line = await updateWhatsAppLine(req.params.lineId, req.body);
      res.json(line);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
