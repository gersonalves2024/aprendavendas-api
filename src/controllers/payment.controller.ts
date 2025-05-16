import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { yapayService, YapayPaymentLinkRequest } from '../services/yapay.service';

const prisma = new PrismaClient();

/**
 * Gera um link de pagamento para um estudante
 * @param req Requisição com o ID do estudante e informações de pagamento
 * @param res Resposta com o link de pagamento gerado
 * @returns Resposta HTTP
 */
export const generatePaymentLink = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { studentId } = req.params;
    const { paymentMethod, maxSplitTransaction = '1' } = req.body;

    // Validar ID do estudante
    if (!studentId || isNaN(Number(studentId))) {
      return res.status(400).json({
        error: 'ID do estudante inválido',
        message: 'O ID do estudante deve ser um número válido',
      });
    }

    // Buscar estudante no banco de dados
    const student = await prisma.student.findUnique({
      where: { id: Number(studentId) },
      include: {
        course: true,
        courseModality: true,
      },
    });

    if (!student) {
      return res.status(404).json({
        error: 'Estudante não encontrado',
        message: 'O estudante informado não foi encontrado no sistema',
      });
    }

    // Verificar se o estudante já tem um link de pagamento pendente
    const existingPaymentLink = await prisma.paymentLink.findFirst({
      where: {
        studentId: Number(studentId),
        status: 1, // Status pendente
      },
    });

    if (existingPaymentLink) {
      return res.status(200).json(existingPaymentLink);
    }

    // Definir métodos de pagamento disponíveis
    let availablePaymentMethods = '27'; // Padrão: PIX
    if (paymentMethod === 'card') {
      availablePaymentMethods = '3,4,5,16'; // Cartões de crédito
    }

    // Gerar número de pedido único (CPF + timestamp)
    const timestamp = new Date().getTime();
    const orderNumber = `${student.cpf.replace(/[^\d]/g, '')}${timestamp}`;

    // Calcular valor final (considerando desconto do cupom, se houver)
    const finalValue = student.discountAmount ? 
      (student.value - student.discountAmount).toFixed(2) : 
      student.value.toFixed(2);

    // Criar descrição do curso
    const description = `${student.courseModality?.name || ''} ${student.course?.name || ''}`.trim();

    // Preparar dados para requisição à API da Yapay
    const paymentData: YapayPaymentLinkRequest = {
      order_number: orderNumber,
      code: student.course?.code || student.course?.id.toString() || 'CURSO',
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
    if (!studentId || isNaN(Number(studentId))) {
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
    const { paymentLinkId } = req.params;
    const { status } = req.body;

    // Validar ID do link de pagamento
    if (!paymentLinkId || isNaN(Number(paymentLinkId))) {
      return res.status(400).json({
        error: 'ID do link de pagamento inválido',
        message: 'O ID do link de pagamento deve ser um número válido',
      });
    }

    // Validar status
    if (status === undefined || isNaN(Number(status))) {
      return res.status(400).json({
        error: 'Status inválido',
        message: 'O status deve ser um número válido',
      });
    }

    // Atualizar status do link de pagamento
    const updatedPaymentLink = await prisma.paymentLink.update({
      where: {
        id: Number(paymentLinkId),
      },
      data: {
        status: Number(status),
      },
    });

    return res.status(200).json(updatedPaymentLink);
  } catch (error) {
    console.error('Erro ao atualizar status do link de pagamento:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível atualizar o status do link de pagamento',
    });
  }
};

export default {
  generatePaymentLink,
  getStudentPaymentLinks,
  updatePaymentLinkStatus,
}; 