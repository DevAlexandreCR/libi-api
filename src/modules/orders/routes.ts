import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireMerchantAccess } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { getOrderById, listOrders, updateOrderStatus, verifyPayment } from './order.service'
import { OrderStatus, UserRole } from '@prisma/client'
import { registerSSE } from '../../utils/sse'
import { forbidden } from '../../utils/errors'

const router = Router()

router.get(
  '/merchants/:merchantId/orders',
  requireAuth,
  requireMerchantAccess(),
  async (req, res, next) => {
    try {
      const { status, from, to, phone } = req.query
      const orders = await listOrders(req.params.merchantId, {
        status: status as OrderStatus | undefined,
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined,
        phone: phone as string | undefined,
      })
      res.json(orders)
    } catch (err) {
      next(err)
    }
  }
)

// Unified SSE endpoint for all merchant events (orders, sessions, messages, etc.)
router.get(
  '/merchants/:merchantId/stream',
  requireAuth,
  requireMerchantAccess(),
  (req, res) => {
    registerSSE(req.params.merchantId, res)
  }
)

router.get('/orders/:orderId', requireAuth, async (req, res, next) => {
  try {
    const order = await getOrderById(req.params.orderId)
    res.json(order)
  } catch (err) {
    next(err)
  }
})

router.patch(
  '/orders/:orderId/status',
  requireAuth,
  validate(
    z.object({
      body: z.object({ status: z.nativeEnum(OrderStatus) }),
    })
  ),
  async (req, res, next) => {
    try {
      const existing = await getOrderById(req.params.orderId)
      if (
        req.user &&
        req.user.role !== UserRole.SUPER_ADMIN &&
        req.user.merchantId &&
        existing.merchantId !== req.user.merchantId
      ) {
        return next(forbidden())
      }
      const order = await updateOrderStatus(req.params.orderId, req.body.status)
      res.json(order)
    } catch (err) {
      next(err)
    }
  }
)

router.patch(
  '/merchants/:merchantId/orders/:orderId/verify-payment',
  requireAuth,
  requireMerchantAccess(),
  validate(
    z.object({
      body: z.object({ verified: z.boolean() }),
    })
  ),
  async (req, res, next) => {
    try {
      const order = await getOrderById(req.params.orderId)
      if (order.merchantId !== req.params.merchantId) {
        return next(forbidden())
      }
      const updated = await verifyPayment(req.params.orderId, req.body.verified)
      res.json(updated)
    } catch (err) {
      next(err)
    }
  }
)

export default router
