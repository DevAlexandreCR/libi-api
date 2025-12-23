import { Router } from 'express'
import { z } from 'zod'
import { UserRole } from '@prisma/client'
import { requireAuth, requireRole } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { createUser, listUsers } from './user.service'

const router = Router()

const createUserSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    role: z.nativeEnum(UserRole),
    merchantId: z.string().optional(),
  }),
})

router.get('/', requireAuth, requireRole(UserRole.SUPER_ADMIN), async (_req, res, next) => {
  try {
    const users = await listUsers()
    res.json(users)
  } catch (err) {
    next(err)
  }
})

router.post(
  '/',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  validate(createUserSchema),
  async (req, res, next) => {
    try {
      const user = await createUser(req.body)
      res.status(201).json(user)
    } catch (err) {
      next(err)
    }
  }
)

export default router
