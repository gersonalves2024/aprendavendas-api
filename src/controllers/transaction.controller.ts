import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { CreateTransactionInput, UpdateTransactionInput } from '../models/transaction.model';
import { handleError, AppError } from '../utils/errorHandler';

const prisma = new PrismaClient();

/**
 * Cria uma nova transação (venda)
 */
export const createTransaction = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Dados já validados pelo middleware
    const transactionData = req.body as CreateTransactionInput;
    
    // Verificar se o usuário está autenticado
    if (!req.user) {
      throw new AppError('Você precisa estar autenticado para realizar esta operação', 401, undefined, 'AUTH_REQUIRED');
    }
    
    // Verificar se o estudante existe
    const student = await prisma.student.findUnique({
      where: { id: transactionData.studentId }
    });
    
    if (!student) {
      throw new AppError('Estudante não encontrado', 404, 'studentId', 'STUDENT_NOT_FOUND');
    }
    
    // Verificar se há cursos informados
    if (!transactionData.courses || transactionData.courses.length === 0) {
      throw new AppError('É necessário informar pelo menos um curso', 400, 'courses', 'COURSES_REQUIRED');
    }
    
    // Verificar se o valor total foi informado
    if (!transactionData.totalValue || transactionData.totalValue <= 0) {
      throw new AppError('É necessário informar um valor total válido', 400, 'totalValue', 'INVALID_TOTAL_VALUE');
    }
    
    // Processar o cupom, se fornecido
    let couponId = null;
    
    if (transactionData.couponCode) {
      try {
        // Buscar cupom pelo código ou nome personalizado
        let coupon = await prisma.coupon.findUnique({
          where: { code: transactionData.couponCode },
        });
        
        if (!coupon) {
          // Tentar buscar por nome personalizado
          const couponByName = await prisma.coupon.findFirst({
            where: { 
              customName: {
                equals: transactionData.couponCode,
                mode: 'insensitive'
              },
              active: true
            }
          });
          
          if (couponByName) {
            coupon = couponByName;
          }
        }
        
        if (!coupon) {
          throw new AppError('Cupom não encontrado', 404, 'couponCode', 'COUPON_NOT_FOUND');
        }
        
        if (!coupon.active) {
          throw new AppError('Cupom inativo', 400, 'couponCode', 'COUPON_INACTIVE');
        }
        
        // Verificar validade e limites do cupom
        if (coupon.expirationDate && new Date() > new Date(coupon.expirationDate)) {
          throw new AppError('Cupom expirado', 400, 'couponCode', 'COUPON_EXPIRED');
        }
        
        if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
          throw new AppError('Limite de uso do cupom excedido', 400, 'couponCode', 'COUPON_USAGE_LIMIT_EXCEEDED');
        }
        
        // Cupom válido, incrementar uso
        await prisma.coupon.update({
          where: { id: coupon.id },
          data: { usageCount: { increment: 1 } }
        });
        
        couponId = coupon.id;
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError('Erro ao processar cupom', 500, 'couponCode', 'COUPON_PROCESSING_ERROR');
      }
    }
    
    // Criar a transação
    // Garantir que a data de pagamento seja a data atual quando o status for Pago
    const currentDate = new Date();
    const paymentDate = 
      transactionData.paymentStatus === 'Pago' 
        ? currentDate 
        : (transactionData.paymentDate ? new Date(transactionData.paymentDate) : null);
    
    const transaction = await prisma.transaction.create({
      data: {
        studentId: transactionData.studentId,
        totalValue: transactionData.totalValue,
        paymentType: transactionData.paymentType,
        installments: transactionData.installments,
        paymentStatus: transactionData.paymentStatus,
        paymentDate: paymentDate,
        paymentForecastDate: transactionData.paymentForecastDate ? new Date(transactionData.paymentForecastDate) : null,
        createdById: req.user.userId,
        couponId: couponId,
        discountAmount: transactionData.discountAmount,
        // Criar os cursos associados à transação
        courses: {
          create: transactionData.courses.map(course => ({
            courseId: course.courseId,
            courseModalityId: course.courseModalityId
          }))
        }
      },
      include: {
        courses: {
          include: {
            course: true,
            courseModality: true
          }
        },
        student: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        coupon: true
      }
    });
    
    return res.status(201).json({
      message: 'Transação criada com sucesso',
      transaction
    });
    
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Obtém uma transação pelo ID
 */
export const getTransactionById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    
    // Validar ID
    if (!id || Number.isNaN(Number(id))) {
      throw new AppError('ID da transação inválido', 400, 'id', 'INVALID_ID');
    }
    
    // Verificar se o usuário está autenticado
    if (!req.user) {
      throw new AppError('Você precisa estar autenticado para realizar esta operação', 401, undefined, 'AUTH_REQUIRED');
    }
    
    // Buscar a transação
    const transaction = await prisma.transaction.findUnique({
      where: { id: Number(id) },
      include: {
        courses: {
          include: {
            course: true,
            courseModality: true
          }
        },
        student: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        coupon: true,
        paymentLinks: true
      }
    });
    
    if (!transaction) {
      throw new AppError('Transação não encontrada', 404, 'id', 'TRANSACTION_NOT_FOUND');
    }
    
    // Verificar permissões (apenas admin e o criador podem ver)
    if (req.user.role !== 'ADMIN' && transaction.createdById !== req.user.userId) {
      throw new AppError('Você não tem permissão para acessar esta transação', 403, undefined, 'PERMISSION_DENIED');
    }
    
    return res.status(200).json(transaction);
    
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Lista transações com filtros e paginação
 */
export const getTransactions = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Dados de paginação
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    
    // Verificar se o usuário está autenticado
    if (!req.user) {
      throw new AppError('Você precisa estar autenticado para realizar esta operação', 401, undefined, 'AUTH_REQUIRED');
    }
    
    // Filtros
    const where: any = {};
    
    // Aplicar filtros por usuário baseado no perfil
    if (req.user.role !== 'ADMIN') {
      where.createdById = req.user.userId;
    } else if (req.query.userId) {
      where.createdById = Number(req.query.userId);
    }
    
    // Filtro por estudante
    if (req.query.studentId) {
      where.studentId = Number(req.query.studentId);
    }
    
    // Filtro por status de pagamento
    if (req.query.paymentStatus) {
      where.paymentStatus = String(req.query.paymentStatus);
    }
    
    // Filtro por data
    if (req.query.startDate || req.query.endDate) {
      where.createdAt = {};
      
      if (req.query.startDate) {
        where.createdAt.gte = new Date(String(req.query.startDate));
      }
      
      if (req.query.endDate) {
        where.createdAt.lte = new Date(String(req.query.endDate));
      }
    }
    
    // Filtro por curso
    if (req.query.courseId) {
      where.courses = {
        some: {
          courseId: Number(req.query.courseId)
        }
      };
    }
    
    // Buscar total de registros
    const total = await prisma.transaction.count({ where });
    
    // Buscar transações com paginação
    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        courses: {
          include: {
            course: true,
            courseModality: true
          }
        },
        student: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });
    
    return res.status(200).json({
      transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
    
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Atualiza uma transação
 */
export const updateTransaction = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const transactionData = req.body as UpdateTransactionInput;
    
    // Validar ID
    if (!id || Number.isNaN(Number(id))) {
      throw new AppError('ID da transação inválido', 400, 'id', 'INVALID_ID');
    }
    
    // Verificar se o usuário está autenticado
    if (!req.user) {
      throw new AppError('Você precisa estar autenticado para realizar esta operação', 401, undefined, 'AUTH_REQUIRED');
    }
    
    // Buscar a transação
    const transaction = await prisma.transaction.findUnique({
      where: { id: Number(id) },
      include: {
        courses: true
      }
    });
    
    if (!transaction) {
      throw new AppError('Transação não encontrada', 404, 'id', 'TRANSACTION_NOT_FOUND');
    }
    
    // Verificar permissões (apenas admin e o criador podem atualizar)
    if (req.user.role !== 'ADMIN' && transaction.createdById !== req.user.userId) {
      throw new AppError('Você não tem permissão para atualizar esta transação', 403, undefined, 'PERMISSION_DENIED');
    }
    
    // Não permite alterar cursos de uma transação com pagamento já realizado
    if (transaction.paymentStatus === 'Pago' && transactionData.courses) {
      throw new AppError('Não é possível alterar os cursos de uma transação já paga', 400, 'courses', 'TRANSACTION_PAID');
    }
    
    // Processar o cupom, se fornecido
    let couponId = transaction.couponId;
    
    if (transactionData.couponCode) {
      try {
        // Buscar cupom pelo código ou nome personalizado
        let coupon = await prisma.coupon.findUnique({
          where: { code: transactionData.couponCode },
        });
        
        if (!coupon) {
          // Tentar buscar por nome personalizado
          const couponByName = await prisma.coupon.findFirst({
            where: { 
              customName: {
                equals: transactionData.couponCode,
                mode: 'insensitive'
              },
              active: true
            }
          });
          
          if (couponByName) {
            coupon = couponByName;
          }
        }
        
        if (!coupon) {
          throw new AppError('Cupom não encontrado', 404, 'couponCode', 'COUPON_NOT_FOUND');
        }
        
        if (!coupon.active) {
          throw new AppError('Cupom inativo', 400, 'couponCode', 'COUPON_INACTIVE');
        }
        
        // Verificar validade e limites do cupom
        if (coupon.expirationDate && new Date() > new Date(coupon.expirationDate)) {
          throw new AppError('Cupom expirado', 400, 'couponCode', 'COUPON_EXPIRED');
        }
        
        if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
          throw new AppError('Limite de uso do cupom excedido', 400, 'couponCode', 'COUPON_USAGE_LIMIT_EXCEEDED');
        }
        
        // Se está trocando de cupom
        if (transaction.couponId !== coupon.id) {
          // Incrementar uso do novo cupom
          await prisma.coupon.update({
            where: { id: coupon.id },
            data: { usageCount: { increment: 1 } }
          });
          
          // Decrementar uso do cupom anterior (se houver)
          if (transaction.couponId) {
            await prisma.coupon.update({
              where: { id: transaction.couponId },
              data: { usageCount: { decrement: 1 } }
            });
          }
        }
        
        couponId = coupon.id;
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError('Erro ao processar cupom', 500, 'couponCode', 'COUPON_PROCESSING_ERROR');
      }
    } else if (transactionData.couponCode === '') {
      // Remover cupom
      if (transaction.couponId) {
        await prisma.coupon.update({
          where: { id: transaction.couponId },
          data: { usageCount: { decrement: 1 } }
        });
      }
      couponId = null;
    }
    
    // Preparar dados de atualização
    const currentDate = new Date();
    
    // Garantir que a data de pagamento seja a data atual quando o status for Pago
    const paymentDate = 
      transactionData.paymentStatus === 'Pago' 
        ? currentDate 
        : (transactionData.paymentDate ? new Date(transactionData.paymentDate) : undefined);
    
    const updateData: any = {
      totalValue: transactionData.totalValue,
      paymentType: transactionData.paymentType,
      installments: transactionData.installments,
      paymentStatus: transactionData.paymentStatus,
      paymentDate: paymentDate,
      paymentForecastDate: transactionData.paymentForecastDate ? new Date(transactionData.paymentForecastDate) : undefined,
      couponId: couponId,
      discountAmount: transactionData.discountAmount
    };
    
    // Filtrar campos undefined
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    // Atualizar a transação
    let updatedTransaction;
    
    // Se estiver atualizando cursos, tratar especialmente
    if (transactionData.courses && transactionData.courses.length > 0) {
      // Remover cursos atuais
      await prisma.transactionCourse.deleteMany({
        where: { transactionId: Number(id) }
      });
      
      // Criar novos cursos
      updatedTransaction = await prisma.transaction.update({
        where: { id: Number(id) },
        data: {
          ...updateData,
          courses: {
            create: transactionData.courses.map(course => ({
              courseId: course.courseId,
              courseModalityId: course.courseModalityId
            }))
          }
        },
        include: {
          courses: {
            include: {
              course: true,
              courseModality: true
            }
          },
          student: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          coupon: true
        }
      });
    } else {
      // Atualização sem modificar cursos
      updatedTransaction = await prisma.transaction.update({
        where: { id: Number(id) },
        data: updateData,
        include: {
          courses: {
            include: {
              course: true,
              courseModality: true
            }
          },
          student: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          coupon: true
        }
      });
    }
    
    return res.status(200).json({
      message: 'Transação atualizada com sucesso',
      transaction: updatedTransaction
    });
    
  } catch (error) {
    return handleError(error, res);
  }
}; 