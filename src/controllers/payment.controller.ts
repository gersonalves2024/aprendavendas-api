import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { yapayService, YapayPaymentLinkRequest } from '../services/yapay.service';
import { paymentStatusUpdater } from '../services/payment-status-updater.service';

const prisma = new PrismaClient();

/**
 * Gera um link de pagamento para um estudante
 * @param req Requisição com o ID do estudante e informações de pagamento
 * @param res Resposta com o link de pagamento gerado
 * @returns Resposta HTTP
 */
export const generatePaymentLink = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Obter studentId dos parâmetros da URL (/:studentId)
    const { studentId } = req.params;
    const { transactionId, paymentMethod, maxSplitTransaction = 12 } = req.body;

    // Validações básicas de entrada
    if (!studentId || Number.isNaN(Number(studentId))) {
      return res.status(400).json({
        error: 'ID do estudante inválido',
        message: 'O ID do estudante deve ser um número válido',
      });
    }

    // Buscar estudante no banco de dados
    const student = await prisma.student.findUnique({
      where: { id: Number(studentId) },
      include: {
        transactions: {
          include: {
            courses: {
              include: {
                course: true,
                courseModality: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      },
    });

    if (!student) {
      return res.status(404).json({
        error: 'Estudante não encontrado',
        message: 'O estudante informado não foi encontrado no sistema',
      });
    }

    // Para links de transações específicas, buscar dados da transação
    let transaction = null;
    if (transactionId) {
      transaction = await prisma.transaction.findFirst({
        where: {
          id: Number(transactionId),
          studentId: Number(studentId)
        },
        include: {
          courses: {
            include: {
              course: true,
              courseModality: true
            }
          }
        }
      });
      
      if (!transaction) {
        return res.status(404).json({
          error: 'Transação não encontrada',
          message: 'A transação especificada não foi encontrada para este estudante'
        });
      }
      
      // Verificar se já existe um link de pagamento pendente para esta transação
      const existingTransactionPaymentLink = await prisma.paymentLink.findFirst({
        where: {
          studentId: Number(studentId),
          transactionId: Number(transactionId),
          status: 1, // Status pendente
        },
      });
      
      if (existingTransactionPaymentLink) {
        return res.status(200).json(existingTransactionPaymentLink);
      }
    } else {
      // Se não for especificada uma transação, verificar se há link pendente para o estudante
      const existingPaymentLink = await prisma.paymentLink.findFirst({
        where: {
          studentId: Number(studentId),
          status: 1, // Status pendente
        },
      });
      
      if (existingPaymentLink) {
        return res.status(200).json(existingPaymentLink);
      }
    }

    // Definir métodos de pagamento disponíveis
    let availablePaymentMethods = '27'; // Padrão: PIX
    if (paymentMethod === 'card') {
      availablePaymentMethods = '3,4,5,16'; // Cartões de crédito
    }

    // Gerar número de pedido único (CPF + timestamp)
    const timestamp = new Date().getTime();
    const orderNumber = `${student.cpf.replace(/[^\d]/g, '')}${timestamp}`;

    // Se tiver transação específica, usar seus dados
    let finalValue, description;
    
    if (transaction) {
      // Usar o valor da transação
      finalValue = transaction.discountAmount ? 
        (transaction.totalValue - transaction.discountAmount).toFixed(2) : 
        transaction.totalValue.toFixed(2);
      
      // Criar descrição baseada nos cursos da transação
      if (transaction.courses && transaction.courses.length > 0) {
        description = transaction.courses.map(c => 
          `${c.courseModality?.name || ''} ${c.course?.name || ''}`
        ).join(', ').trim();
      } else {
        description = 'Cursos';
      }
    } else {
      // Usar valores da transação mais recente (comportamento adaptado)
      const latestTransaction = student.transactions && student.transactions.length > 0 
        ? student.transactions[0] 
        : null;
      
      if (!latestTransaction) {
        return res.status(400).json({
          error: 'Transação não encontrada',
          message: 'O estudante não possui nenhuma transação registrada'
        });
      }
      
      finalValue = latestTransaction.discountAmount ? 
        (latestTransaction.totalValue - latestTransaction.discountAmount).toFixed(2) : 
        latestTransaction.totalValue.toFixed(2);
      
      // Criar descrição baseada nos cursos da transação
      if (latestTransaction.courses && latestTransaction.courses.length > 0) {
        description = latestTransaction.courses.map(c => 
          `${c.courseModality?.name || ''} ${c.course?.name || ''}`
        ).join(', ').trim();
      } else {
        description = 'Cursos';
      }
      
      // Atualizar a variável de transação para usar nas chamadas seguintes
      transaction = latestTransaction;
    }

    // Preparar dados para requisição à API da Yapay
    const paymentData: YapayPaymentLinkRequest = {
      order_number: orderNumber,
      code: transaction?.id.toString() || 'CURSO',
      value: finalValue,
      description: description || 'Curso',
      max_split_transaction: maxSplitTransaction,
      available_payment_methods: availablePaymentMethods,
      new_checkout: true,
      use_cards: false,
    };

    // Adicionar email apenas se existir
    if (student.email) {
      paymentData.customer_email = student.email;
    }

    // Gerar link de pagamento na API da Yapay
    const paymentLinkResponse = await yapayService.generatePaymentLink(paymentData);

    // Converter o status booleano para inteiro (1 = true, 0 = false)
    const statusInt = typeof paymentLinkResponse.status === 'boolean' 
      ? (paymentLinkResponse.status ? 1 : 0) 
      : (paymentLinkResponse.status || 1); // Fallback para 1 (pendente) se undefined

    console.log("Status original da API:", paymentLinkResponse.status);
    console.log("Status convertido para Int:", statusInt);

    // Salvar link de pagamento no banco de dados
    const paymentLink = await prisma.paymentLink.create({
      data: {
        yapayId: paymentLinkResponse.id,
        orderNumber: paymentLinkResponse.order_number,
        code: paymentLinkResponse.code,
        value: paymentLinkResponse.value,
        description: paymentLinkResponse.description,
        maxSplitTransaction: paymentLinkResponse.max_split_transaction,
        availablePaymentMethods: paymentLinkResponse.available_payment_methods,
        paymentLink: paymentLinkResponse.payment_link,
        status: statusInt,
        studentId: Number(studentId),
        transactionId: transaction ? Number(transaction.id) : undefined,
      },
    });

    return res.status(201).json(paymentLink);
  } catch (error) {
    console.error('Erro ao gerar link de pagamento:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível gerar o link de pagamento',
    });
  }
};

/**
 * Obtém os links de pagamento de um estudante
 * @param req Requisição com o ID do estudante
 * @param res Resposta com os links de pagamento do estudante
 * @returns Resposta HTTP
 */
export const getStudentPaymentLinks = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { studentId } = req.params;

    // Validar ID do estudante
    if (!studentId || Number.isNaN(Number(studentId))) {
      return res.status(400).json({
        error: 'ID do estudante inválido',
        message: 'O ID do estudante deve ser um número válido',
      });
    }

    // Buscar links de pagamento do estudante
    const paymentLinks = await prisma.paymentLink.findMany({
      where: {
        studentId: Number(studentId),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.status(200).json(paymentLinks);
  } catch (error) {
    console.error('Erro ao buscar links de pagamento:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível buscar os links de pagamento',
    });
  }
};

/**
 * Atualiza o status de um link de pagamento
 * @param req Requisição com o ID do link de pagamento e o novo status
 * @param res Resposta com o link de pagamento atualizado
 * @returns Resposta HTTP
 */
export const updatePaymentLinkStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { linkId } = req.params;
    const { status } = req.body;

    // Validar ID do link
    if (!linkId || Number.isNaN(Number(linkId))) {
      return res.status(400).json({
        error: 'ID do link inválido',
        message: 'O ID do link deve ser um número válido',
      });
    }

    // Validar status
    if (!status || !['1', '2', '3'].includes(String(status))) {
      return res.status(400).json({
        error: 'Status inválido',
        message: 'O status deve ser 1 (pendente), 2 (pago) ou 3 (cancelado)',
      });
    }

    // Buscar link de pagamento
    const paymentLink = await prisma.paymentLink.findUnique({
      where: { id: Number(linkId) },
      include: { 
        student: true,
        transaction: true
      },
    });

    if (!paymentLink) {
      return res.status(404).json({
        error: 'Link não encontrado',
        message: 'O link de pagamento informado não foi encontrado',
      });
    }

    // Atualizar status do link
    const updatedPaymentLink = await prisma.paymentLink.update({
      where: { id: Number(linkId) },
      data: { status: Number(status) },
    });

    // Mapear status numérico para texto
    const systemStatus = Number(status) === 1 ? 'Pendente' : 
                         Number(status) === 2 ? 'Pago' : 
                         Number(status) === 3 ? 'Cancelado' : 'Desconhecido';
    
    // Se o status foi alterado para pago (2), atualizar na transação
    if (Number(status) === 2) {
      // Se tiver transação associada, atualizar o status e a data de pagamento na transação
      if (paymentLink.transactionId) {
        await prisma.transaction.update({
          where: { id: paymentLink.transactionId },
          data: {
            paymentStatus: 'Pago',
            paymentDate: new Date()
          }
        });
        
        // Não precisamos mais atualizar o status no estudante pois foi removido
      } else {
        // Caso não tenha transação associada, não fazemos nada
        console.log('Não há transação associada a este link de pagamento, status do estudante não foi atualizado');
      }
    } else if (Number(status) === 3) {
      // Se foi cancelado (3)
      // Se tiver transação associada, atualizar o status na transação
      if (paymentLink.transactionId) {
        await prisma.transaction.update({
          where: { id: paymentLink.transactionId },
          data: {
            paymentStatus: 'Cancelado',
            // Limpar data de pagamento caso estivesse preenchida
            paymentDate: null
          }
        });
        
        // Não precisamos mais atualizar o status no estudante pois foi removido
      } else {
        // Caso não tenha transação associada, não fazemos nada
        console.log('Não há transação associada a este link de pagamento, status do estudante não foi atualizado');
      }
    }

    return res.status(200).json({
      message: 'Status do link de pagamento atualizado com sucesso',
      paymentLink: updatedPaymentLink,
    });
  } catch (error) {
    console.error('Erro ao atualizar status do link de pagamento:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível atualizar o status do link de pagamento',
    });
  }
};

/**
 * Verifica e atualiza o status de todos os pagamentos pendentes
 * @param req Requisição
 * @param res Resposta
 * @returns Resposta HTTP com estatísticas de atualização
 */
export const checkPendingPayments = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Verificar se o usuário está autenticado e tem permissão
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuário não autenticado',
        message: 'É necessário estar autenticado para executar esta operação'
      });
    }

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Permissão negada',
        message: 'Apenas administradores podem executar esta operação'
      });
    }

    console.log('Iniciando verificação de pagamentos pendentes (acionada manualmente)');
    const result = await paymentStatusUpdater.updatePendingPayments();

    return res.status(200).json({
      message: 'Verificação de pagamentos concluída',
      stats: {
        checked: result.checked,
        updated: result.updated,
        errors: result.errors
      },
      details: result.details
    });
  } catch (error) {
    console.error('Erro ao verificar pagamentos pendentes:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível verificar os pagamentos pendentes'
    });
  }
};

/**
 * Verifica e atualiza o status de um link de pagamento específico de um estudante
 * @param req Requisição com o ID do estudante
 * @param res Resposta
 * @returns Resposta HTTP com o resultado da verificação
 */
export const checkStudentPaymentStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { studentId } = req.params;

    // Validar ID do estudante
    if (!studentId || Number.isNaN(Number(studentId))) {
      return res.status(400).json({
        error: 'ID do estudante inválido',
        message: 'O ID do estudante deve ser um número válido',
      });
    }

    // Verificar se o usuário está autenticado
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuário não autenticado',
        message: 'É necessário estar autenticado para executar esta operação'
      });
    }

    console.log(`Verificando status do último link de pagamento do estudante ID ${studentId}...`);
    const result = await paymentStatusUpdater.checkSpecificPaymentLink(Number(studentId), true);

    if (result.error && !result.orderNumber) {
      return res.status(404).json({
        message: result.error
      });
    }

    if (result.updated) {
      return res.status(200).json({
        message: `Status do pagamento atualizado com sucesso de ${result.oldStatus} para ${result.newStatus}`,
        studentUpdated: result.studentUpdated,
        orderNumber: result.orderNumber,
        oldStatus: result.oldStatus,
        newStatus: result.newStatus
      });
    } else {
      return res.status(200).json({
        message: result.error || `Status do pagamento não mudou (${result.newStatus})`,
        orderNumber: result.orderNumber,
        status: result.newStatus
      });
    }
  } catch (error) {
    console.error('Erro ao verificar status do pagamento:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível verificar o status do pagamento'
    });
  }
};

/**
 * Obtém os links de pagamento de uma transação específica
 * @param req Requisição com o ID do estudante e da transação
 * @param res Resposta com os links de pagamento da transação
 * @returns Resposta HTTP
 */
export const getTransactionPaymentLinks = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { studentId, transactionId } = req.params;

    // Validar IDs
    if (!studentId || Number.isNaN(Number(studentId))) {
      return res.status(400).json({
        error: 'ID do estudante inválido',
        message: 'O ID do estudante deve ser um número válido',
      });
    }

    if (!transactionId || Number.isNaN(Number(transactionId))) {
      return res.status(400).json({
        error: 'ID da transação inválido',
        message: 'O ID da transação deve ser um número válido',
      });
    }

    // Buscar links de pagamento da transação específica
    const paymentLinks = await prisma.paymentLink.findMany({
      where: {
        studentId: Number(studentId),
        transactionId: Number(transactionId),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.status(200).json(paymentLinks);
  } catch (error) {
    console.error('Erro ao buscar links de pagamento da transação:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível buscar os links de pagamento da transação',
    });
  }
}; 