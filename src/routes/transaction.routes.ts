import express from 'express';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware';
import * as transactionController from '../controllers/transaction.controller';

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

/**
 * @route   POST /api/transactions
 * @desc    Cria uma nova transação
 * @access  Private
 */
router.post('/', transactionController.createTransaction);

/**
 * @route   GET /api/transactions
 * @desc    Lista todas as transações com filtros
 * @access  Private
 */
router.get('/', transactionController.getTransactions);

/**
 * @route   GET /api/transactions/:id
 * @desc    Obtém uma transação pelo ID
 * @access  Private
 */
router.get('/:id', transactionController.getTransactionById);

/**
 * @route   PUT /api/transactions/:id
 * @desc    Atualiza uma transação
 * @access  Private
 */
router.put('/:id', transactionController.updateTransaction);

export default router; 