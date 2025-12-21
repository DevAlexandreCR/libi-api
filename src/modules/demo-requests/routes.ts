import { Router } from 'express'
import { z } from 'zod'
import { DemoRequestStatus, UserRole } from '@prisma/client'
import { validate } from '../../middleware/validate'
import { createDemoRequest, listDemoRequests, updateDemoRequest } from './service'
import { requireAuth, requireRole } from '../../middleware/auth'

const router = Router()

router.post(
  '/demo-requests',
  validate(
    z.object({
      body: z.object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        company: z.string().optional(),
        message: z.string().optional(),
        source: z.string().optional(),
      }),
    })
  ),
  async (req, res, next) => {
    try {
      const created = await createDemoRequest(req.body)
      res.status(201).json(created)
    } catch (err) {
      next(err)
    }
  }
)

router.get(
  '/demo-requests',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  validate(
    z.object({
      query: z.object({
        status: z.nativeEnum(DemoRequestStatus).optional(),
      }),
    })
  ),
  async (req, res, next) => {
    try {
      const status = req.query.status as DemoRequestStatus | undefined
      const list = await listDemoRequests({ status })
      res.json(list)
    } catch (err) {
      next(err)
    }
  }
)

router.patch(
  '/demo-requests/:id',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  validate(
    z.object({
      params: z.object({ id: z.string() }),
      body: z.object({
        status: z.nativeEnum(DemoRequestStatus).optional(),
      }),
    })
  ),
  async (req, res, next) => {
    try {
      const updated = await updateDemoRequest(req.params.id, req.body)
      res.json(updated)
    } catch (err) {
      next(err)
    }
  }
)

export default router
