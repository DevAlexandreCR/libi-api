import { Router } from 'express'
import { z } from 'zod'
import { PaymentAccountType } from '@prisma/client'
import * as paymentAccountService from './payment-account.service'
import { requireAuth } from '../../middleware/auth'
import { validate } from '../../middleware/validate'

const router = Router()

const createPaymentAccountSchema = z.object({
  body: z.object({
    type: z.nativeEnum(PaymentAccountType),
    accountNumber: z.string().min(1),
    accountHolder: z.string().min(1),
    bankName: z.string().optional().or(z.literal('')),
    description: z.string().optional().or(z.literal('')),
    isActive: z.boolean().optional(),
  }),
})

const updatePaymentAccountSchema = z.object({
  body: z.object({
    type: z.nativeEnum(PaymentAccountType).optional(),
    accountNumber: z.string().min(1).optional(),
    accountHolder: z.string().min(1).optional(),
    bankName: z.string().optional().or(z.literal('')),
    description: z.string().optional().or(z.literal('')),
    isActive: z.boolean().optional(),
  }),
})

// Create payment account
router.post('/', requireAuth, validate(createPaymentAccountSchema), async (req, res, next) => {
  try {
    const merchantId = req.user!.merchantId!
    const account = await paymentAccountService.createPaymentAccount(merchantId, req.body)
    res.status(201).json(account)
  } catch (error) {
    next(error)
  }
})

// List payment accounts
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const merchantId = req.user!.merchantId!
    const activeOnly = req.query.activeOnly === 'true'
    const accounts = await paymentAccountService.listPaymentAccounts(merchantId, activeOnly)
    res.json(accounts)
  } catch (error) {
    next(error)
  }
})

// Get payment account by ID
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const account = await paymentAccountService.getPaymentAccountById(req.params.id)
    // Check if user has access to this merchant
    if (account.merchantId !== req.user!.merchantId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    res.json(account)
  } catch (error) {
    next(error)
  }
})

// Update payment account
router.put('/:id', requireAuth, validate(updatePaymentAccountSchema), async (req, res, next) => {
  try {
    const account = await paymentAccountService.getPaymentAccountById(req.params.id)
    // Check if user has access to this merchant
    if (account.merchantId !== req.user!.merchantId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const updated = await paymentAccountService.updatePaymentAccount(req.params.id, req.body)
    res.json(updated)
  } catch (error) {
    next(error)
  }
})

// Delete payment account
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const account = await paymentAccountService.getPaymentAccountById(req.params.id)
    // Check if user has access to this merchant
    if (account.merchantId !== req.user!.merchantId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    await paymentAccountService.deletePaymentAccount(req.params.id)
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export default router
