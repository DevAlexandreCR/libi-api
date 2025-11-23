import { Router } from 'express'
import { loginAdmin, loginBusiness, registerBusiness } from '../controllers/authController.js'

const router = Router()

router.post('/login/admin', loginAdmin)
router.post('/login/business', loginBusiness)
router.post('/register/business', registerBusiness)

export default router
