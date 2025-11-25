import { Router } from 'express';
import authRoutes from '../modules/auth/routes';
import merchantRoutes from '../modules/merchants/routes';
import whatsappRoutes from '../modules/whatsapp/routes';
import menuRoutes from '../modules/menus/routes';
import menuImportRoutes from '../modules/menu-import/routes';
import orderRoutes from '../modules/orders/routes';
import sessionRoutes from '../modules/sessions/routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/', merchantRoutes);
router.use('/', whatsappRoutes);
router.use('/', menuRoutes);
router.use('/', menuImportRoutes);
router.use('/', orderRoutes);
router.use('/', sessionRoutes);

export default router;
