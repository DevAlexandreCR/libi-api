import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireMerchantAccess } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { getActiveMenu, setMenuItemAvailability } from './menu.service'

const router = Router()

router.get(
  '/merchants/:merchantId/menus/current',
  requireAuth,
  requireMerchantAccess(),
  async (req, res, next) => {
    try {
      const menu = await getActiveMenu(req.params.merchantId)
      res.json(menu)
    } catch (err) {
      next(err)
    }
  }
)

router.patch(
  '/menu-items/:menuItemId/availability',
  requireAuth,
  validate(z.object({ body: z.object({ isAvailable: z.boolean() }) })),
  async (req, res, next) => {
    try {
      const item = await setMenuItemAvailability(req.params.menuItemId, req.body.isAvailable)
      res.json(item)
    } catch (err) {
      next(err)
    }
  }
)

export default router
