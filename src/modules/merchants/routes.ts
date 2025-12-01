import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import {
  createMerchant,
  deleteMerchant,
  getMerchant,
  listMerchants,
  updateMerchant,
} from './merchant.service'
import { UserRole } from '@prisma/client'

const router = Router()

const merchantBody = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  timezone: z.string().optional(),
})

router.get('/', requireAuth, requireRole(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const merchants = await listMerchants(req.query.search as string | undefined)
    res.json(merchants)
  } catch (err) {
    next(err)
  }
})

router.post(
  '/',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  validate(z.object({ body: merchantBody })),
  async (req, res, next) => {
    try {
      const merchant = await createMerchant(req.body)
      res.status(201).json(merchant)
    } catch (err) {
      next(err)
    }
  }
)

router.get(
  '/:merchantId',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  async (req, res, next) => {
    try {
      const merchant = await getMerchant(req.params.merchantId)
      res.json(merchant)
    } catch (err) {
      next(err)
    }
  }
)

router.put(
  '/:merchantId',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  validate(z.object({ body: merchantBody.partial() })),
  async (req, res, next) => {
    try {
      const merchant = await updateMerchant(req.params.merchantId, req.body)
      res.json(merchant)
    } catch (err) {
      next(err)
    }
  }
)

router.delete(
  '/:merchantId',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  async (req, res, next) => {
    try {
      const deleted = await deleteMerchant(req.params.merchantId)
      res.json(deleted)
    } catch (err) {
      next(err)
    }
  }
)

export default router
