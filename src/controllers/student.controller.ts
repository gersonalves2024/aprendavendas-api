import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { CreateStudentInput, UpdateStudentInput } from '../models/student.model';
import { handleError, AppError } from '../utils/errorHandler';
import { createStudentSchema } from '../models/schemas/student.schema';

const prisma = new PrismaClient();

/**
 * Cria um novo aluno
 */
export const createStudent = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Obtem dados do corpo da requisição
    const result = createStudentSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: 'Dados de corpo da requisição inválidos',
        details: result.error.format()
      });
    }

    const studentData = result.data;

    // Se não tiver userId no request body, usa o ID do usuário autenticado
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        error: 'Usuário não autenticado',
        message: 'É necessário estar autenticado para criar um estudante'
      });
    }

    // Debug para ajudar a identificar problemas com datas
    console.log('=== DEBUG PAYLOAD RECEBIDO ===');
    console.log(studentData);
    console.log('=== FIM PAYLOAD ===');

    // Processar datas adequadamente
    console.log('=== DEBUG DATAS ===');
    console.log('Tipo paymentDate:', typeof studentData.paymentDate);
    console.log('Valor paymentDate:', studentData.paymentDate);
    console.log('Tipo paymentForecastDate:', typeof studentData.paymentForecastDate);
    console.log('Valor paymentForecastDate:', studentData.paymentForecastDate);
    console.log('JSON stringify paymentDate:', JSON.stringify(studentData.paymentDate));
    console.log('JSON stringify paymentForecastDate:', JSON.stringify(studentData.paymentForecastDate));

    // Convertendo datas para o formato correto
    // Isso garante que as datas sejam tratadas como Date e não string
    const paymentDate = studentData.paymentDate ? new Date(studentData.paymentDate) : null;
    const paymentForecastDate = studentData.paymentForecastDate ? new Date(studentData.paymentForecastDate) : null;
    const birthDate = studentData.birthDate ? new Date(studentData.birthDate) : null;

    console.log('Datas processadas:');
    console.log('Data de pagamento convertida:', paymentDate);
    console.log('Previsão de pagamento convertida:', paymentForecastDate);

    // Cria o aluno com as datas processadas corretamente
    try {
      const newStudent = await prisma.student.create({
        data: {
          fullName: studentData.fullName,
          ddd: studentData.ddd,
          phone: studentData.phone,
          email: studentData.email || null,
          birthDate: birthDate,
          cpf: studentData.cpf,
          cnhNumber: studentData.cnhNumber || null,
          cnhType: studentData.cnhType || null,
          renach: studentData.renach || null,
          courseId: studentData.courseId,
          courseModalityId: studentData.courseModalityId,
          value: studentData.value,
          paymentType: studentData.paymentType,
          installments: studentData.installments,
          paymentStatus: studentData.paymentStatus,
          paymentDate: paymentDate,
          paymentForecastDate: paymentForecastDate,
          userId: userId,
        },
        include: {
          course: true,
          courseModality: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      return res.status(201).json(newStudent);
    } catch (dbError) {
      // Log do erro para depuração
      console.error('Erro capturado:', dbError);
      throw dbError;
    }
  } catch (error) {
    console.error('Erro ao criar aluno:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Ocorreu um erro inesperado. Por favor, tente novamente mais tarde.'
    });
  }
};

/**
 * Busca alunos com filtros e paginação
 */
export const getStudents = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Dados já validados pelo middleware
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    
    // Garantir que page e limit são números inteiros positivos
    const pageInt = Math.max(1, Math.floor(page));
    const limitInt = Math.max(1, Math.floor(limit));
    
    const filters = req.query;
    
    // Debug específico para o problema de CPF
    console.log('URL da requisição:', req.url);
    console.log('Query string bruta:', req.url.split('?')[1] || '');
    
    // Obtém o CPF diretamente da query string original
    const cpfParam = req.url.includes('cpf=') ? 
      req.url.split('cpf=')[1].split('&')[0] : 
      null;
    
    console.log('CPF extraído manualmente:', cpfParam);
    console.log('CPF no objeto filters:', filters.cpf);
    
    // Debug para verificar os filtros recebidos
    console.log('Filtros recebidos:', {
      cpf: filters.cpf,
      typeofCpf: typeof filters.cpf,
      fullName: filters.fullName,
      courseId: filters.courseId,
      courseModalityId: filters.courseModalityId,
      paymentStatus: filters.paymentStatus
    });
    
    // Verifica se o usuário está autenticado
    if (!req.user) {
      throw new AppError('Você precisa estar autenticado para realizar esta operação', 401, undefined, 'AUTH_REQUIRED');
    }
    
    // Prepara condições de busca usando o tipo correto do Prisma
    const where: Prisma.StudentWhereInput = {};
    
    // Filtrar alunos baseado no perfil do usuário
    if (req.user.role === 'SELLER') {
      // Vendedor só pode ver seus próprios alunos
      where.userId = req.user.userId;
    } else if (req.user.role === 'AFFILIATE') {
      // Afiliado só pode ver seus próprios alunos (registrados por ele)
      where.userId = req.user.userId;
    } else if (filters.userId) {
      // Se for admin e especificou userId, filtra por esse usuário
      where.userId = Number(filters.userId);
    }
    
    // Aplica o filtro de CPF manualmente 
    if (cpfParam) {
      // Usar o valor de CPF extraído diretamente da URL
      where.cpf = cpfParam;
      console.log('Filtro CPF aplicado manualmente:', where.cpf);
    } else if (filters.cpf) {
      // Fallback para o valor do objeto filters, se existir
      where.cpf = String(filters.cpf);
      console.log('Filtro CPF aplicado via filters:', where.cpf);
    }
    
    // Aplica outros filtros 
    if (filters.fullName) where.fullName = { contains: String(filters.fullName), mode: 'insensitive' };
    if (filters.courseId) where.courseId = Number(filters.courseId);
    if (filters.courseModalityId) where.courseModalityId = Number(filters.courseModalityId);
    if (filters.paymentStatus) where.paymentStatus = String(filters.paymentStatus);
    
    // Filtro de datas
    if (filters.startDate || filters.endDate) {
      where.registrationDate = {
        ...(filters.startDate && { gte: new Date(String(filters.startDate)) }),
        ...(filters.endDate && { lte: new Date(String(filters.endDate)) })
      };
    }
    
    // Log final das condições de busca
    console.log('Condições finais da busca:', JSON.stringify(where));
    
    // Busca os alunos paginados
    const allStudents = await prisma.student.findMany({
      where,
      orderBy: { registrationDate: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        course: true,
        courseModality: true
      }
    });
    
    // Log dos resultados para debug
    console.log(`Quantidade de resultados: ${allStudents.length}`);
    if (allStudents.length > 0) {
      console.log('CPFs encontrados:', allStudents.map(s => s.cpf).join(', '));
    }
    
    // Aplica paginação manual
    const total = allStudents.length;
    const paginatedStudents = allStudents.slice(
      (pageInt - 1) * limitInt,
      pageInt * limitInt
    );
    
    return res.status(200).json({
      students: paginatedStudents,
      total,
      page: pageInt,
      limit: limitInt,
      totalPages: Math.ceil(total / limitInt)
    });
    
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Busca um aluno pelo ID
 */
export const getStudentById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    
    if (!id || Number.isNaN(Number(id))) {
      throw new AppError('O ID do aluno deve ser um número válido', 400, 'id', 'INVALID_ID');
    }
    
    // Verifica se o usuário está autenticado
    if (!req.user) {
      throw new AppError('Você precisa estar autenticado para realizar esta operação', 401, undefined, 'AUTH_REQUIRED');
    }
    
    // Busca o aluno
    const student = await prisma.student.findUnique({
      where: { id: Number.parseInt(id, 10) },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        course: true,
        courseModality: true
      }
    });
    
    if (!student) {
      throw new AppError('Não foi possível encontrar um aluno com o ID especificado', 404, 'id', 'STUDENT_NOT_FOUND');
    }
    
    // Verifica se o usuário tem permissão para ver este aluno
    if ((req.user.role === 'SELLER' || req.user.role === 'AFFILIATE') && student.userId !== req.user.userId) {
      throw new AppError('Você não tem permissão para acessar este aluno', 403, undefined, 'PERMISSION_DENIED');
    }
    
    return res.status(200).json(student);
    
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Atualiza um aluno
 */
export const updateStudent = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    
    if (!id || Number.isNaN(Number(id))) {
      throw new AppError('O ID do aluno deve ser um número válido', 400, 'id', 'INVALID_ID');
    }
    
    // Dados já validados pelo middleware
    const studentData = req.body as UpdateStudentInput;
    
    // Verifica se o usuário está autenticado
    if (!req.user) {
      throw new AppError('Você precisa estar autenticado para realizar esta operação', 401, undefined, 'AUTH_REQUIRED');
    }
    
    // Verifica se o usuário tem permissão para editar (apenas ADMIN e SELLER)
    if (req.user.role === 'AFFILIATE') {
      throw new AppError('Afiliados não podem editar informações de alunos', 403, undefined, 'PERMISSION_DENIED');
    }
    
    // Busca o aluno
    const student = await prisma.student.findUnique({
      where: { id: Number.parseInt(id, 10) }
    });
    
    if (!student) {
      throw new AppError('Não foi possível encontrar um aluno com o ID especificado', 404, 'id', 'STUDENT_NOT_FOUND');
    }
    
    // Verifica se o usuário tem permissão para editar este aluno
    if (req.user.role === 'SELLER' && student.userId !== req.user.userId) {
      throw new AppError('Você não tem permissão para editar este aluno', 403, undefined, 'PERMISSION_DENIED');
    }
    
    // Verifica se o CPF foi alterado e se já existe outro aluno com o novo CPF
    if (studentData.cpf && studentData.cpf !== student.cpf) {
      const existingStudent = await prisma.student.findUnique({
        where: { cpf: studentData.cpf }
      });
      
      if (existingStudent && existingStudent.id !== student.id) {
        throw new AppError('Já existe outro aluno cadastrado com este CPF', 409, 'cpf', 'DUPLICATE_CPF');
      }
    }
    
    // Atualiza o aluno
    const updatedStudent = await prisma.student.update({
      where: { id: Number.parseInt(id, 10) },
      data: {
        ...studentData,
        birthDate: studentData.birthDate === null || studentData.birthDate === undefined 
          ? null 
          : new Date(studentData.birthDate),
        paymentDate: studentData.paymentDate === null || studentData.paymentDate === undefined 
          ? null 
          : new Date(studentData.paymentDate),
        paymentForecastDate: studentData.paymentForecastDate === null || studentData.paymentForecastDate === undefined
          ? null
          : new Date(studentData.paymentForecastDate)
      }
    });
    
    return res.status(200).json({
      message: 'Aluno atualizado com sucesso',
      student: updatedStudent
    });
    
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Exclui um aluno
 */
export const deleteStudent = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    
    if (!id || Number.isNaN(Number(id))) {
      throw new AppError('O ID do aluno deve ser um número válido', 400, 'id', 'INVALID_ID');
    }
    
    // Verifica se o usuário está autenticado
    if (!req.user) {
      throw new AppError('Você precisa estar autenticado para realizar esta operação', 401, undefined, 'AUTH_REQUIRED');
    }
    
    // Verifica se o usuário tem permissão para excluir (apenas ADMIN pode)
    if (req.user.role !== 'ADMIN') {
      throw new AppError('Apenas administradores podem excluir alunos', 403, undefined, 'ADMIN_REQUIRED');
    }
    
    // Verifica se o aluno existe
    const student = await prisma.student.findUnique({
      where: { id: Number.parseInt(id, 10) }
    });
    
    if (!student) {
      throw new AppError('Não foi possível encontrar um aluno com o ID especificado', 404, 'id', 'STUDENT_NOT_FOUND');
    }
    
    // Exclui o aluno
    await prisma.student.delete({
      where: { id: Number.parseInt(id, 10) }
    });
    
    return res.status(200).json({
      message: 'Aluno excluído com sucesso'
    });
    
  } catch (error) {
    return handleError(error, res);
  }
}; 