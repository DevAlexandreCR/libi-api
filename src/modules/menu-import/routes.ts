import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireMerchantAccess } from '../../middleware/auth'
import { upload } from '../uploads'
import { saveUploads, processMenuExtraction } from './service'
import { validate } from '../../middleware/validate'

const router = Router()

router.post(
  '/merchants/:merchantId/menu-import/uploads',
  requireAuth,
  requireMerchantAccess(),
  upload.array('files', 5),
  async (req, res, next) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined
      if (!files) {
        return res.status(400).json({ error: 'No files uploaded' })
      }
      const uploads = await saveUploads(req.params.merchantId, files)
      res.status(201).json(uploads)
    } catch (err) {
      next(err)
    }
  }
)

router.post(
  '/merchants/:merchantId/menu-import/process',
  requireAuth,
  requireMerchantAccess(),
  validate(
    z.object({
      body: z.object({ uploadIds: z.array(z.string()).min(1) }),
    })
  ),
  async (req, res, next) => {
    try {
      const result = await processMenuExtraction(req.params.merchantId, req.body.uploadIds)
      res.json(result)
    } catch (err) {
      next(err)
    }
  }
)

export default router
