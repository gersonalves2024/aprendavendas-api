import express from 'express';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware';
import * as paymentController from '../controllers/payment.controller';

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

/**
 * @route   POST /api/payments/link/:studentId
 * @desc    Gera um link de pagamento para um estudante
 * @access  Private
 */
router.post('/link/:studentId', paymentController.generatePaymentLink);

/**
 * @route   GET /api/payments/link/:studentId
 * @desc    Obtém os links de pagamento de um estudante
 * @access  Private
 */
router.get('/link/:studentId', paymentController.getStudentPaymentLinks);

/**
 * @route   GET /api/payments/link/:studentId/transaction/:transactionId
 * @desc    Obtém os links de pagamento de uma transação específica
 * @access  Private
 */
router.get('/link/:studentId/transaction/:transactionId', paymentController.getTransactionPaymentLinks);

/**
 * @route   PUT /api/payments/link/:linkId
 * @desc    Atualiza o status de um link de pagamento
 * @access  Private
 */
router.put('/link/:linkId/status', paymentController.updatePaymentLinkStatus);

/**
 * @route   POST /api/payments/check-pending
 * @desc    Verifica e atualiza o status de pagamentos pendentes
 * @access  Private (Admin only)
 */
router.post('/check-pending', requireAdmin, paymentController.checkPendingPayments);

/**
 * @route   POST /api/payments/check-student/:studentId
 * @desc    Verifica e atualiza o status do último link de pagamento de um estudante
 * @access  Private
 */
router.post('/check-student/:studentId', paymentController.checkStudentPaymentStatus);

export default router; 