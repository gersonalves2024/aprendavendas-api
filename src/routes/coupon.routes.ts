import { Router } from 'express';
import * as couponController from '../controllers/coupon.controller';
import { validate } from '../middlewares/validation.middleware';
import {
  createCouponSchema,
  generalCouponConfigSchema,
  specificCouponConfigSchema,
  updateCouponApplicationModeSchema,
  validateCouponSchema,
} from '../schemas/coupon.schema';
import { authenticate, requireProfile } from '../middlewares/auth.middleware';
import { Role } from '../models/user.model';

const router = Router();

// Rotas públicas
router.get('/validate/:code', couponController.getCouponByCode);
router.post('/validate', validate(validateCouponSchema), couponController.validateCoupon);

// Rotas para administradores
router.get('/', authenticate, requireProfile([Role.ADMIN]), couponController.listAllCoupons);
router.post('/', authenticate, requireProfile([Role.ADMIN]), validate(createCouponSchema), couponController.createCoupon);
router.post('/mode', authenticate, requireProfile([Role.ADMIN]), validate(updateCouponApplicationModeSchema), couponController.updateCouponApplicationMode);
router.post('/config/general', authenticate, requireProfile([Role.ADMIN]), validate(generalCouponConfigSchema), couponController.createGeneralCouponConfig);
router.post('/config/specific', authenticate, requireProfile([Role.ADMIN]), validate(specificCouponConfigSchema), couponController.createSpecificCouponConfig);
router.get('/config/:couponId', authenticate, requireProfile([Role.ADMIN]), couponController.getCouponConfigurations);
router.delete('/config/:configId', authenticate, requireProfile([Role.ADMIN]), couponController.deleteCouponConfiguration);
router.patch('/status/:couponId', authenticate, requireProfile([Role.ADMIN]), couponController.toggleCouponStatus);

// Rotas para afiliados
router.get('/affiliate/:userId', authenticate, couponController.getAffiliateCoupon);
router.get('/affiliate/:userId/dashboard', authenticate, couponController.getAffiliateDashboardStats);

// Rotas para vendedores
router.get('/seller/:userId/dashboard', authenticate, couponController.getSellerDashboardStats);

// Rotas para qualquer usuário (afiliado ou vendedor)
router.get('/user/:userId', authenticate, couponController.getActiveUserCoupon);

export default router; 