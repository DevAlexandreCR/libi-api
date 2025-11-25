import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../middleware/validate'
import { login } from './auth.service'

const router = Router()

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
  }),
})

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const result = await login(req.body.email, req.body.password)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

export default router
