import express from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import paymentController from '../controllers/payment.controller';

const router = express.Router();

/**
 * @route POST /api/payments/students/:studentId
 * @desc Gera um link de pagamento para um estudante
 * @access Private
 */
router.post('/students/:studentId', authenticate, paymentController.generatePaymentLink);

/**
 * @route GET /api/payments/students/:studentId
 * @desc Obtém os links de pagamento de um estudante
 * @access Private
 */
router.get('/students/:studentId', authenticate, paymentController.getStudentPaymentLinks);

/**
 * @route PUT /api/payments/:paymentLinkId/status
 * @desc Atualiza o status de um link de pagamento
 * @access Private
 */
router.put('/:paymentLinkId/status', authenticate, paymentController.updatePaymentLinkStatus);

export default router; 