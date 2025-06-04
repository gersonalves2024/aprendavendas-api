import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { CreateStudentInput, UpdateStudentInput } from '../models/student.model';
import { handleError, AppError } from '../utils/errorHandler';
import { createStudentSchema, addCoursesToStudentSchema, updateStudentBasicSchema } from '../models/schemas/student.schema';

// Interface para uso no mapeamento de cursos
interface CourseInput {
  courseId: string | number;
  courseModalityId: string | number;
}

const prisma = new PrismaClient();

/**
 * Cria um novo aluno
 */
export const createStudent = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Obtem dados do corpo da requisição
    const validation = createStudentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Dados de corpo da requisição inválidos',
        details: validation.error.format()
      });
    }

    const studentData = validation.data;

    // Se não tiver userId no request body, usa o ID do usuário autenticado
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        error: 'Usuário não autenticado',
        message: 'É necessário estar autenticado para criar um estudante'
      });
    }

    // Verificar se já existe um estudante com este CPF que tenha transações pendentes
    const existingStudentWithCPF = await prisma.student.findFirst({
      where: { cpf: studentData.cpf },
      include: {
        transactions: {
          where: { paymentStatus: 'Pendente' }
        }
      }
    });

    if (existingStudentWithCPF && existingStudentWithCPF.transactions.length > 0) {
      return res.status(400).json({
        error: 'Transação pendente existente',
        message: 'Já existe um aluno com este CPF que possui uma transação pendente. Resolva a transação pendente antes de criar um novo registro.',
        existingStudentId: existingStudentWithCPF.id,
        pendingTransactions: existingStudentWithCPF.transactions
      });
    }

    // Debug para ajudar a identificar problemas com datas
    console.log('=== DEBUG PAYLOAD RECEBIDO ===');
    console.log(studentData);
    console.log('=== FIM PAYLOAD ===');

    // Verificar se existem múltiplos cursos
    const hasManyCoursesFeature = studentData.courses && studentData.courses.length > 0;
    
    // Se estiver usando o novo recurso, verificar se o valor total foi informado
    if (hasManyCoursesFeature && (!studentData.totalValue || studentData.totalValue <= 0)) {
      return res.status(400).json({
        error: 'Valor total não informado',
        message: 'É necessário informar o valor total para múltiplos cursos'
      });
    }

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

    // SOLUÇÃO 3: Buscar e validar o cupom ANTES da transação, mas só usar dentro dela
    let cupomValidado = null;
    if (studentData.couponCode) {
      try {
        // Buscar cupom pelo código primeiro
        let coupon = await prisma.coupon.findUnique({
          where: { code: studentData.couponCode },
          include: {
            user: true,
          },
        });

        // Se não encontrou pelo código, tentar pelo nome personalizado
        if (!coupon) {
          console.log(`Cupom não encontrado pelo código "${studentData.couponCode}", tentando buscar por nome personalizado`);
          
          const couponsWithCustomName = await prisma.coupon.findMany({
            where: { 
              customName: {
                equals: studentData.couponCode,
                mode: 'insensitive'
              },
              active: true 
            },
            include: {
              user: true,
            },
          });

          console.log(`Encontrados ${couponsWithCustomName.length} cupons com o nome personalizado "${studentData.couponCode}":`, 
            couponsWithCustomName.map(c => ({ id: c.id, code: c.code, customName: c.customName })));

          // Se encontrou exatamente um cupom com o nome personalizado, usar esse
          if (couponsWithCustomName.length === 1) {
            console.log(`Usando cupom encontrado por nome personalizado: ${couponsWithCustomName[0].code}`);
            coupon = couponsWithCustomName[0];
          }
          // Se encontrou mais de um, usar o primeiro ativo
          else if (couponsWithCustomName.length > 1) {
            const activeCoupon = couponsWithCustomName.find(c => c.active);
            if (activeCoupon) {
              console.log(`Encontrados múltiplos cupons, usando o primeiro ativo: ${activeCoupon.code}`);
              coupon = activeCoupon;
            }
          }
        }

        // Realizar validações de cupom
        if (!coupon) {
          console.log('Cupom não encontrado. Continuando sem aplicar cupom.');
        } 
        else if (!coupon.active) {
          console.log('Cupom inativo. Continuando sem aplicar cupom.');
        }
        else if (coupon.expirationDate && new Date() > new Date(coupon.expirationDate)) {
          console.log('Cupom expirado. Continuando sem aplicar cupom.');
        }
        else if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
          console.log('Limite de uso excedido. Continuando sem aplicar cupom.');
        }
        else {
          // Tudo certo, armazenamos o cupom validado para uso dentro da transação
          cupomValidado = coupon;
          console.log(`Cupom ${studentData.couponCode} validado com sucesso. ID: ${coupon.id}`);
          console.log(`Desconto: ${studentData.discountAmount}, Comissão: ${studentData.affiliateCommission}`);
        }
      } catch (couponError) {
        console.error('Erro ao processar cupom (fora da transação):', couponError);
        console.log('Continuando sem aplicar cupom devido ao erro.');
      }
    }

    // Agora usar uma transação para garantir que ambas as operações (criar aluno e criar transação) sejam atômicas
    try {
      const result = await prisma.$transaction(async (prismaTransaction) => {
        // 1. Criar o estudante com apenas dados pessoais, sem informações de curso ou pagamento
        const newStudent = await prismaTransaction.student.create({
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
            userId: userId,
          },
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        });

        // 2. Sempre criar uma transação, independente se é múltiplos cursos ou não
        // Preparar os cursos para a transação
        const coursesForTransaction = studentData.courses && studentData.courses.length > 0 
          ? studentData.courses 
          : [{
              courseId: studentData.courseId,
              courseModalityId: studentData.courseModalityId
            }];

        // Verificar o perfil do usuário e forçar status como "Pendente" se for vendedor
        const paymentStatus = req.user?.role === 'SELLER' ? 'Pendente' : studentData.paymentStatus;
        
        // Criar a transação dentro da mesma transação do Prisma para garantir atomicidade
        // Usar o cupom validado previamente para evitar nova consulta
        const transaction = await prismaTransaction.transaction.create({
          data: {
            studentId: newStudent.id,
            totalValue: studentData.totalValue || studentData.value,
            paymentType: studentData.paymentType,
            installments: studentData.installments,
            paymentStatus: paymentStatus,
            paymentDate: paymentStatus === 'Pago' ? paymentDate : null, // Data de pagamento só se for Pago
            paymentForecastDate: paymentForecastDate,
            createdById: userId,
            couponId: cupomValidado?.id || null, // Usar o cupom já validado, sem novas consultas
            discountAmount: studentData.discountAmount,
            // Criar os cursos associados à transação
            courses: {
              create: coursesForTransaction.map(course => ({
                courseId: Number(course.courseId),
                courseModalityId: Number(course.courseModalityId)
              }))
            }
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

        // Se temos um cupom válido, incrementamos o contador DENTRO da transação
        // Isso garante atomicidade completa
        if (cupomValidado) {
          await prismaTransaction.coupon.update({
            where: { id: cupomValidado.id },
            data: { usageCount: { increment: 1 } },
          });
          console.log(`Contador de uso do cupom ${cupomValidado.id} incrementado com sucesso (dentro da transação).`);
        }

        // Retornar os resultados
        return { newStudent, transaction };
      });

      return res.status(201).json({
        message: 'Estudante cadastrado com sucesso',
        student: result.newStudent,
        transaction: result.transaction
      });
    } catch (transactionError) {
      console.error('Erro capturado:', transactionError);
      return handleError(transactionError, res);
    }
  } catch (error) {
    console.error('Erro geral na criação de estudante:', error);
    return handleError(error, res);
  }
};

/**
 * Adiciona cursos a um aluno existente
 */
export const addCoursesToStudent = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Obter ID do estudante da URL
    const studentId = Number(req.params.id);
    
    if (Number.isNaN(studentId)) {
      return res.status(400).json({
        error: 'ID de estudante inválido',
        message: 'O ID do estudante deve ser um número válido'
      });
    }
    
    // Converter valores numéricos explicitamente
    const bodyData = {
      ...req.body,
      courseId: req.body.courseId ? Number(req.body.courseId) : undefined,
      courseModalityId: req.body.courseModalityId ? Number(req.body.courseModalityId) : undefined,
      value: req.body.value ? Number(req.body.value) : undefined,
      totalValue: req.body.totalValue ? Number(req.body.totalValue) : undefined,
      installments: req.body.installments ? Number(req.body.installments) : undefined,
      courses: Array.isArray(req.body.courses) 
        ? req.body.courses.map((course: CourseInput) => ({
            courseId: Number(course.courseId),
            courseModalityId: Number(course.courseModalityId)
          }))
        : undefined
    };

    // Validar dados usando schema específico para adicionar cursos
    const validation = addCoursesToStudentSchema.safeParse(bodyData);

    if (!validation.success) {
      console.log('Erro de validação:', validation.error.format());
      return res.status(400).json({
        error: 'Dados de corpo da requisição inválidos',
        details: validation.error.format()
      });
    }

    const transactionData = validation.data;
    
    // Se não tiver userId no request body, usa o ID do usuário autenticado
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        error: 'Usuário não autenticado',
        message: 'É necessário estar autenticado para adicionar cursos'
      });
    }
    
    // Buscar o estudante pelo ID para confirmar que ele existe
    const existingStudent = await prisma.student.findUnique({
      where: { id: studentId },
    });
    
    if (!existingStudent) {
      return res.status(404).json({
        error: 'Estudante não encontrado',
        message: 'O estudante com o ID fornecido não foi encontrado'
      });
    }
    
    // Verificar se o aluno já possui transações pendentes
    const pendingTransactions = await prisma.transaction.findMany({
      where: { 
        studentId: studentId,
        paymentStatus: 'Pendente'
      }
    });
    
    if (pendingTransactions.length > 0) {
      return res.status(400).json({
        error: 'Transação pendente existente',
        message: 'Este aluno já possui uma transação pendente. Resolva a transação pendente antes de adicionar novos cursos.',
        pendingTransactions: pendingTransactions
      });
    }
    
    // Verificar se há pelo menos um curso para adicionar
    const hasManyCoursesFeature = transactionData.courses && transactionData.courses.length > 0;
    
    if (!hasManyCoursesFeature && (!transactionData.courseId || !transactionData.courseModalityId)) {
      return res.status(400).json({
        error: 'Nenhum curso informado',
        message: 'É necessário informar pelo menos um curso para adicionar'
      });
    }
    
    // Processar datas
    const paymentDate = transactionData.paymentDate ? new Date(transactionData.paymentDate) : null;
    const paymentForecastDate = transactionData.paymentForecastDate ? new Date(transactionData.paymentForecastDate) : null;
    
    // SOLUÇÃO 3: Buscar e validar o cupom ANTES da transação, mas só usar dentro dela
    let cupomValidado = null;
    if (transactionData.couponCode) {
      try {
        // Buscar cupom pelo código
        let coupon = await prisma.coupon.findUnique({
          where: { code: transactionData.couponCode },
        });

        // Se não encontrou pelo código, tentar encontrar pelo nome personalizado
        if (!coupon) {
          console.log(`Cupom não encontrado pelo código "${transactionData.couponCode}", tentando buscar por nome personalizado`);
          const couponsWithCustomName = await prisma.coupon.findMany({
            where: { 
              customName: {
                equals: transactionData.couponCode,
                mode: 'insensitive' // Busca case-insensitive
              },
              active: true 
            }
          });

          console.log(`Encontrados ${couponsWithCustomName.length} cupons com o nome personalizado "${transactionData.couponCode}"`);
          
          // Se encontrou exatamente um cupom com o nome personalizado, usar esse
          if (couponsWithCustomName.length === 1) {
            console.log(`Usando cupom encontrado por nome personalizado: ${couponsWithCustomName[0].code}`);
            coupon = couponsWithCustomName[0];
          }
          // Se encontrou mais de um, usar o primeiro ativo
          else if (couponsWithCustomName.length > 1) {
            const activeCoupon = couponsWithCustomName.find(c => c.active);
            if (activeCoupon) {
              console.log(`Encontrados múltiplos cupons, usando o primeiro ativo: ${activeCoupon.code}`);
              coupon = activeCoupon;
            }
          }
        }

        // Verificar se o cupom é válido antes de usar
        if (!coupon) {
          console.log('Cupom não encontrado. Continuando sem aplicar cupom.');
        } 
        else if (!coupon.active) {
          console.log('Cupom inativo. Continuando sem aplicar cupom.');
        }
        else if (coupon.expirationDate && new Date() > new Date(coupon.expirationDate)) {
          console.log('Cupom expirado. Continuando sem aplicar cupom.');
        }
        else if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
          console.log('Limite de uso excedido. Continuando sem aplicar cupom.');
        }
        else {
          // Tudo certo, armazenamos o cupom validado para uso dentro da transação
          cupomValidado = coupon;
          console.log(`Cupom ${transactionData.couponCode} validado com sucesso. ID: ${coupon.id}`);
          console.log(`Desconto: ${transactionData.discountAmount}`);
        }
      } catch (couponError) {
        // Log do erro e continuar sem cupom
        console.error('Erro ao processar cupom (fora da transação):', couponError);
        console.log('Continuando sem aplicar cupom devido ao erro.');
      }
    }
    
    // Verificar o perfil do usuário e forçar status como "Pendente" se for vendedor
    const paymentStatus = req.user?.role === 'SELLER' ? 'Pendente' : transactionData.paymentStatus;
    
    // Agora usar uma transação para garantir atomicidade de todas as operações
    try {
      const transaction = await prisma.$transaction(async (prismaTransaction) => {
        // Criar uma nova transação para este estudante com os novos cursos
        const newTransaction = await prismaTransaction.transaction.create({
          data: {
            studentId: existingStudent.id,
            totalValue: transactionData.totalValue || transactionData.value || 0,
            paymentType: transactionData.paymentType,
            installments: transactionData.installments,
            paymentStatus: paymentStatus,
            paymentDate: paymentStatus === 'Pago' ? paymentDate : null, // Data de pagamento só se for Pago
            paymentForecastDate: paymentForecastDate,
            createdById: userId,
            couponId: cupomValidado?.id || null, // Usar o cupom já validado
            discountAmount: transactionData.discountAmount,
            // Criar os cursos associados à transação
            courses: {
              create: transactionData.courses?.map(course => ({
                courseId: Number(course.courseId),
                courseModalityId: Number(course.courseModalityId)
              })) || [{
                courseId: Number(transactionData.courseId),
                courseModalityId: Number(transactionData.courseModalityId)
              }]
            }
          },
          include: {
            courses: {
              include: {
                course: true,
                courseModality: true
              }
            },
            coupon: true
          }
        });
        
        // Se temos um cupom válido, incrementamos o contador DENTRO da transação
        // Isso garante atomicidade completa
        if (cupomValidado) {
          await prismaTransaction.coupon.update({
            where: { id: cupomValidado.id },
            data: { usageCount: { increment: 1 } },
          });
          console.log(`Contador de uso do cupom ${cupomValidado.id} incrementado com sucesso (dentro da transação).`);
        }
        
        return newTransaction;
      });
      
      // Buscar o estudante atualizado com a nova transação
      const updatedStudent = await prisma.student.findUnique({
        where: { id: existingStudent.id },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          transactions: {
            include: {
              courses: {
                include: {
                  course: true,
                  courseModality: true
                }
              }
            }
          }
        }
      });
    
      return res.status(200).json({
        message: 'Novos cursos adicionados com sucesso',
        student: updatedStudent,
        transaction
      });
    } catch (transactionError) {
      console.error('Erro na transação:', transactionError);
      return handleError(transactionError, res);
    }
  } catch (error) {
    console.error('Erro ao adicionar cursos a aluno existente:', error);
    return handleError(error, res);
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
      fullName: filters.fullName
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
        transactions: {
          include: {
            courses: {
              include: {
                course: true,
                courseModality: true
              }
            },
            coupon: true
          }
        }
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
        transactions: {
          include: {
            courses: {
              include: {
                course: true,
                courseModality: true
              }
            },
            coupon: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
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
 * Atualiza um aluno existente
 */
export const updateStudent = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const studentData = req.body as UpdateStudentInput;

    // Validação manual do ID
    if (!id || Number.isNaN(Number.parseInt(id, 10))) {
      return res.status(400).json({ 
        error: 'ID inválido', 
        message: 'O ID do aluno precisa ser um número válido'
      });
    }

    // Verificar se o usuário está autenticado
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        error: 'Usuário não autenticado',
        message: 'É necessário estar autenticado para atualizar um estudante'
      });
    }

    // Verificar se o aluno existe
    const existingStudent = await prisma.student.findUnique({
      where: { id: Number.parseInt(id, 10) },
      include: {
        transactions: true
      }
    });

    if (!existingStudent) {
      return res.status(404).json({ 
        error: 'Aluno não encontrado', 
        message: 'Não foi possível encontrar um aluno com o ID informado'
      });
    }

    // Verificar permissões (apenas admin e o criador podem atualizar)
    if ((!req.user || req.user.role !== 'ADMIN') && existingStudent.userId !== userId) {
      return res.status(403).json({
        error: 'Permissão negada',
        message: 'Você não tem permissão para atualizar este aluno'
      });
    }

    // Verificar restrições para vendedores
    if (req.user?.role === 'SELLER' && 
        studentData.transactions && studentData.transactions.length > 0) {
      
      for (const transaction of studentData.transactions) {
        // Vendedor só pode alterar para status 'Cancelado'
        if (transaction.paymentStatus && transaction.paymentStatus !== 'Pendente' && transaction.paymentStatus !== 'Cancelado') {
          return res.status(403).json({
            error: 'Permissão negada',
            message: 'Vendedores só podem cancelar transações, não podem marcar como pagas'
          });
        }
      }
    }

    // Verificar se está adicionando novos cursos
    const addingNewCourses = studentData.courses && studentData.courses.length > 0;
    
    // Se estiver adicionando novos cursos, verificar se o valor total foi informado
    if (addingNewCourses && (!studentData.totalValue || studentData.totalValue <= 0)) {
      return res.status(400).json({
        error: 'Valor total não informado',
        message: 'É necessário informar o valor total para novos cursos'
      });
    }
    
    // SOLUÇÃO 3: Buscar e validar cupom antes da transação, mas usá-lo dentro dela
    let cupomValidado = null;
    
    if (studentData.couponCode) {
      try {
        // Buscar cupom pelo código
        let coupon = await prisma.coupon.findUnique({
          where: { code: studentData.couponCode },
        });
        
        // Se não encontrou pelo código, tentar pelo nome personalizado
        if (!coupon) {
          const couponsWithCustomName = await prisma.coupon.findMany({
            where: { 
              customName: {
                equals: studentData.couponCode,
                mode: 'insensitive'
              },
              active: true 
            }
          });
          
          // Se encontrou exatamente um cupom com o nome personalizado, usar esse
          if (couponsWithCustomName.length === 1) {
            coupon = couponsWithCustomName[0];
          }
          // Se encontrou mais de um, usar o primeiro ativo
          else if (couponsWithCustomName.length > 1) {
            const activeCoupon = couponsWithCustomName.find(c => c.active);
            if (activeCoupon) {
              coupon = activeCoupon;
            }
          }
        }
        
        // Verificar se o cupom é válido
        if (!coupon) {
          console.log('Cupom não encontrado. Continuando sem aplicar cupom.');
        } 
        else if (!coupon.active) {
          console.log('Cupom inativo. Continuando sem aplicar cupom.');
        }
        else if (coupon.expirationDate && new Date() > new Date(coupon.expirationDate)) {
          console.log('Cupom expirado. Continuando sem aplicar cupom.');
        }
        else if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
          console.log('Limite de uso excedido. Continuando sem aplicar cupom.');
        }
        else {
          // Tudo certo, armazenamos o cupom validado para uso dentro da transação
          cupomValidado = coupon;
        }
      } catch (error) {
        console.error('Erro ao buscar cupom:', error);
        // Continuar sem cupom
      }
    }

    // Usar uma transação para garantir atomicidade
    try {
      const result = await prisma.$transaction(async (prismaTransaction) => {
        // Atualiza o aluno
        const updatedStudent = await prismaTransaction.student.update({
          where: { id: Number.parseInt(id, 10) },
          data: {
            fullName: studentData.fullName,
            ddd: studentData.ddd,
            phone: studentData.phone,
            email: studentData.email,
            cpf: studentData.cpf,
            cnhNumber: studentData.cnhNumber,
            cnhType: studentData.cnhType,
            renach: studentData.renach,
            birthDate: studentData.birthDate ? new Date(studentData.birthDate) : null,
          },
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            transactions: {
              include: {
                courses: {
                  include: {
                    course: true,
                    courseModality: true
                  }
                },
                coupon: true
              }
            }
          }
        });

        // Se estiver adicionando novos cursos, criar uma nova transação
        let transaction = null;
        if (addingNewCourses && studentData.courses && studentData.totalValue) {
          // Criar a transação dentro da mesma transação do Prisma para garantir atomicidade
          transaction = await prismaTransaction.transaction.create({
            data: {
              studentId: updatedStudent.id,
              totalValue: studentData.totalValue,
              paymentType: studentData.paymentType || 'PIX',
              installments: studentData.installments || 1,
              paymentStatus: studentData.paymentStatus || 'Pendente',
              paymentDate: studentData.paymentDate,
              paymentForecastDate: studentData.paymentForecastDate,
              createdById: userId,
              couponId: cupomValidado?.id || null, // Usar o cupom já validado
              discountAmount: studentData.discountAmount,
              // Criar os cursos associados à transação
              courses: {
                create: studentData.courses.map(course => ({
                  courseId: Number(course.courseId),
                  courseModalityId: Number(course.courseModalityId)
                }))
              }
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
          
          // Se temos um cupom válido, incrementamos o contador DENTRO da transação
          // Isso garante atomicidade completa
          if (cupomValidado) {
            await prismaTransaction.coupon.update({
              where: { id: cupomValidado.id },
              data: { usageCount: { increment: 1 } },
            });
            console.log(`Contador de uso do cupom ${cupomValidado.id} incrementado com sucesso (dentro da transação).`);
          }
        }

        return { updatedStudent, transaction };
      });

      return res.status(200).json({
        message: 'Estudante atualizado com sucesso',
        student: result.updatedStudent,
        transaction: result.transaction
      });
    } catch (transactionError) {
      console.error('Erro na transação:', transactionError);
      return handleError(transactionError, res);
    }
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

/**
 * Exclui uma transação específica de um aluno
 */
export const deleteTransaction = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { studentId, transactionId } = req.params;
    
    if (!studentId || Number.isNaN(Number(studentId)) || !transactionId || Number.isNaN(Number(transactionId))) {
      return res.status(400).json({
        error: 'IDs inválidos',
        message: 'Os IDs do aluno e da transação devem ser números válidos'
      });
    }
    
    // Verifica se o usuário está autenticado
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuário não autenticado',
        message: 'É necessário estar autenticado para excluir uma transação'
      });
    }
    
    // Verifica se o usuário tem permissão para excluir (apenas ADMIN pode)
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Permissão negada',
        message: 'Apenas administradores podem excluir transações'
      });
    }
    
    // Verifica se a transação existe e pertence ao aluno especificado
    const transaction = await prisma.transaction.findFirst({
      where: { 
        id: Number.parseInt(transactionId, 10),
        studentId: Number.parseInt(studentId, 10)
      }
    });
    
    if (!transaction) {
      return res.status(404).json({
        error: 'Transação não encontrada',
        message: 'A transação especificada não foi encontrada ou não pertence ao aluno informado'
      });
    }
    
    // Impedir a exclusão de transações com status "Pago"
    if (transaction.paymentStatus === 'Pago') {
      return res.status(403).json({
        error: 'Operação não permitida',
        message: 'Não é possível excluir uma transação com status de pagamento "Pago"'
      });
    }
    
    // Se a transação tem cupom, decrementar o contador de uso
    if (transaction.couponId) {
      await prisma.coupon.update({
        where: { id: transaction.couponId },
        data: { usageCount: { decrement: 1 } }
      });
    }
    
    // Exclui a transação e todos os registros relacionados usando uma transação do banco de dados
    await prisma.$transaction(async (prismaTransaction) => {
      // Primeiro, exclui os links de pagamento associados à transação
      const paymentLinks = await prismaTransaction.paymentLink.findMany({
        where: { 
          transactionId: Number.parseInt(transactionId, 10)
        }
      });
      
      if (paymentLinks.length > 0) {
        console.log(`Excluindo ${paymentLinks.length} links de pagamento associados à transação ${transactionId}`);
        
        await prismaTransaction.paymentLink.deleteMany({
          where: { 
            transactionId: Number.parseInt(transactionId, 10)
          }
        });
      }
      
      // Exclui os cursos associados à transação
      await prismaTransaction.transactionCourse.deleteMany({
        where: { 
          transactionId: Number.parseInt(transactionId, 10)
        }
      });
      
      // Por fim, exclui a transação
      await prismaTransaction.transaction.delete({
        where: { 
          id: Number.parseInt(transactionId, 10)
        }
      });
    });
    
    return res.status(200).json({
      message: 'Transação e links de pagamento associados excluídos com sucesso'
    });
    
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Função auxiliar para buscar o ID de um cupom pelo código ou nome personalizado
 * NOTA: Não incrementa o contador de uso, isso deve ser feito dentro da transação principal
 * IMPORTANTE: Esta função não deve ser chamada diretamente fora de um contexto de transação.
 * Use a lógica diretamente dentro do bloco de $transaction para evitar o erro "Transaction already closed".
 * @deprecated Não use diretamente, implemente a lógica diretamente dentro do bloco de transação
 */
async function getCouponId(couponCode: string): Promise<number | null> {
  // Buscar cupom pelo código
  let coupon = await prisma.coupon.findUnique({
    where: { code: couponCode },
  });

  // Se não encontrou pelo código, tentar encontrar pelo nome personalizado
  if (!coupon) {
    const couponsWithCustomName = await prisma.coupon.findMany({
      where: { 
        customName: {
          equals: couponCode,
          mode: 'insensitive' // Busca case-insensitive
        },
        active: true 
      }
    });

    // Se encontrou algum cupom ativo com esse nome personalizado, usar o primeiro
    if (couponsWithCustomName.length > 0) {
      coupon = couponsWithCustomName[0];
    }
  }

  // Se encontrou o cupom e ele está ativo, retornar o ID
  if (coupon?.active) {
    // NÃO incrementar o uso aqui
    return coupon.id;
  }

  return null;
}

// Cria a migração do Prisma
const migrationQuery = `
-- AlterTable
ALTER TABLE "Student" DROP COLUMN "courseId",
                     DROP COLUMN "courseModalityId",
                     DROP COLUMN "value",
                     DROP COLUMN "paymentType",
                     DROP COLUMN "installments",
                     DROP COLUMN "paymentStatus", 
                     DROP COLUMN "paymentDate",
                     DROP COLUMN "paymentForecastDate", 
                     DROP COLUMN "couponId",
                     DROP COLUMN "discountAmount",
                     DROP COLUMN "affiliateCommission";

-- RemoveReferencesToStudent
ALTER TABLE "Course" DROP CONSTRAINT IF EXISTS "Course_students_fkey";
ALTER TABLE "CourseModality" DROP CONSTRAINT IF EXISTS "CourseModality_students_fkey";
ALTER TABLE "Coupon" DROP CONSTRAINT IF EXISTS "Coupon_students_fkey";
`;

// Executa a migração
export const executeMigration = async () => {
  try {
    await prisma.$executeRawUnsafe(migrationQuery);
    console.log("Migração executada com sucesso");
  } catch (error) {
    console.error("Erro ao executar migração:", error);
  }
};

/**
 * Atualiza apenas os dados básicos de um aluno (sem cursos ou transações)
 */
export const updateStudentBasicInfo = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const studentData = req.body;

    // Validação do schema de dados básicos
    const validation = updateStudentBasicSchema.safeParse(studentData);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Dados de corpo da requisição inválidos',
        details: validation.error.format()
      });
    }

    // Validação manual do ID
    if (!id || Number.isNaN(Number.parseInt(id, 10))) {
      return res.status(400).json({ 
        error: 'ID inválido', 
        message: 'O ID do aluno precisa ser um número válido'
      });
    }

    // Verificar se o usuário está autenticado
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        error: 'Usuário não autenticado',
        message: 'É necessário estar autenticado para atualizar um estudante'
      });
    }

    // Verificar se o aluno existe
    const existingStudent = await prisma.student.findUnique({
      where: { id: Number.parseInt(id, 10) }
    });

    if (!existingStudent) {
      return res.status(404).json({ 
        error: 'Aluno não encontrado', 
        message: 'Não foi possível encontrar um aluno com o ID informado'
      });
    }

    // Verificar permissões (apenas admin e o criador podem atualizar)
    if ((!req.user || req.user.role !== 'ADMIN') && existingStudent.userId !== userId) {
      return res.status(403).json({
        error: 'Permissão negada',
        message: 'Você não tem permissão para atualizar este aluno'
      });
    }

    // Converter datas para o formato correto
    let birthDate = existingStudent.birthDate;

    if (studentData.birthDate !== undefined) {
      birthDate = studentData.birthDate ? new Date(studentData.birthDate) : null;
    }

    // Atualiza apenas os dados básicos do aluno
    const updatedStudent = await prisma.student.update({
      where: { id: Number.parseInt(id, 10) },
      data: {
        fullName: studentData.fullName,
        ddd: studentData.ddd,
        phone: studentData.phone,
        email: studentData.email,
        birthDate,
        cnhNumber: studentData.cnhNumber,
        cnhType: studentData.cnhType,
        renach: studentData.renach,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        transactions: {
          include: {
            courses: {
              include: {
                course: true,
                courseModality: true
              }
            },
            coupon: true
          }
        }
      }
    });

    return res.status(200).json({
      message: 'Dados básicos do aluno atualizados com sucesso',
      student: updatedStudent
    });
  } catch (error) {
    return handleError(error, res);
  }
}; 