import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { ReportFilters } from '../models/schemas/report.schema';
import type { 
  ReportResult, 
  GroupedReportResult, 
  ReportTotals,
  StatisticsResult,
  ColumnDefinition,
  ReportStudent
} from '../models/report.model';
import { handleError, AppError } from '../utils/errorHandler';
import { ExportFormat } from '../models/schemas/report.schema';

const prisma = new PrismaClient();

/**
 * Gera relatório de alunos com filtros avançados
 */
export const generateReport = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Dados já validados pelo middleware
    const filters = req.query as unknown as ReportFilters;
    
    // Verifica se o usuário está autenticado
    if (!req.user) {
      throw new AppError('Você precisa estar autenticado para realizar esta operação', 401, undefined, 'AUTH_REQUIRED');
    }
    
    // Prepara as condições de busca usando o tipo correto do Prisma
    const where = buildWhereClause(filters, req.user.role === 'ADMIN', req.user.userId);
    
    // Conta o total para paginação
    const total = await prisma.student.count({ where });
    
    // Determina a ordenação
    const orderBy = buildOrderByClause(
      filters.sortBy, 
      filters.sortOrder as 'asc' | 'desc' | undefined
    );
    
    // Busca os alunos paginados
    const students = await prisma.student.findMany({
      where,
      skip: ((filters.page || 1) - 1) * (filters.limit || 10),
      take: filters.limit || 10,
      orderBy,
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
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });
    
    // Processa os resultados para o formato do relatório
    const processedStudents = students.map(student => {
      // Obter dados da transação mais recente (se existir)
      const latestTransaction = student.transactions && student.transactions.length > 0 
        ? student.transactions.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] 
        : null;
      
      return {
        ...student,
        // Usar dados da transação mais recente
        paymentDate: latestTransaction?.paymentDate 
          ? latestTransaction.paymentDate.toISOString().split('T')[0] 
          : null,
        paymentForecastDate: latestTransaction?.paymentForecastDate 
          ? latestTransaction.paymentForecastDate.toISOString().split('T')[0] 
          : null,
        paymentStatus: latestTransaction?.paymentStatus || null,
        paymentType: latestTransaction?.paymentType || null,
        value: latestTransaction?.totalValue || null,
        age: calculateAge(student.birthDate)
      };
    });
    
    // Calcula totais e estatísticas
    const totals = calculateTotals(processedStudents);
    
    // Prepara resultado agrupado se solicitado
    let grouped: GroupedReportResult[] | undefined;
    if (filters.groupBy) {
      grouped = groupResults(processedStudents, filters.groupBy);
    }
    
    const result: ReportResult = {
      students: processedStudents,
      grouped,
      totals,
      filters,
      pagination: {
        page: filters.page || 1,
        limit: filters.limit || 10,
        total,
        totalPages: Math.ceil(total / (filters.limit || 10))
      }
    };
    
    return res.status(200).json(result);
    
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Gera estatísticas gerais dos alunos
 */
export const generateStatistics = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Dados já validados pelo middleware
    const filters = req.query as unknown as ReportFilters;
    
    // Verifica se o usuário está autenticado
    if (!req.user) {
      throw new AppError('Você precisa estar autenticado para realizar esta operação', 401, undefined, 'AUTH_REQUIRED');
    }
    
    // Prepara as condições de busca
    const where = buildWhereClause(filters, req.user.role === 'ADMIN', req.user.userId);
    
    // Busca todos os alunos que atendem aos filtros (sem paginação)
    const students = await prisma.student.findMany({
      where,
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
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });
    
    // Processa os resultados
    const processedStudents = students.map(student => {
      // Obter dados da transação mais recente (se existir)
      const latestTransaction = student.transactions && student.transactions.length > 0 
        ? student.transactions.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] 
        : null;
      
      return {
        ...student,
        // Usar dados da transação mais recente
        paymentDate: latestTransaction?.paymentDate 
          ? latestTransaction.paymentDate.toISOString().split('T')[0] 
          : null,
        paymentForecastDate: latestTransaction?.paymentForecastDate 
          ? latestTransaction.paymentForecastDate.toISOString().split('T')[0] 
          : null,
        paymentStatus: latestTransaction?.paymentStatus || null,
        paymentType: latestTransaction?.paymentType || null,
        value: latestTransaction?.totalValue || null,
        age: calculateAge(student.birthDate)
      };
    });
    
    // Calcula estatísticas gerais
    const overall = calculateOverallStatistics(processedStudents);
    
    // Calcula estatísticas por período (mensal)
    const byPeriod = calculatePeriodStatistics(processedStudents);
    
    // Calcula estatísticas por vendedor (apenas para admins)
    let bySeller;
    if (req.user.role === 'ADMIN') {
      bySeller = calculateSellerStatistics(processedStudents);
    }
    
    const result: StatisticsResult = {
      overall,
      byPeriod,
      ...(bySeller && { bySeller })
    };
    
    return res.status(200).json(result);
    
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Exporta relatório em formato específico
 */
export const exportReport = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Dados já validados pelo middleware
    const { format, ...filters } = req.query as unknown as ReportFilters & { format: string };
    
    // Verifica se o usuário está autenticado
    if (!req.user) {
      throw new AppError('Você precisa estar autenticado para realizar esta operação', 401, undefined, 'AUTH_REQUIRED');
    }
    
    // Prepara as condições de busca
    const where = buildWhereClause(filters, req.user.role === 'ADMIN', req.user.userId);
    
    // Busca todos os alunos que atendem aos filtros (sem paginação para exportação)
    const students = await prisma.student.findMany({
      where,
      orderBy: buildOrderByClause(
        filters.sortBy, 
        filters.sortOrder as 'asc' | 'desc' | undefined
      ),
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
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });
    
    // Processa os resultados
    const processedStudents = students.map(student => {
      // Obter dados da transação mais recente (se existir)
      const latestTransaction = student.transactions && student.transactions.length > 0 
        ? student.transactions.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] 
        : null;
      
      return {
        ...student,
        // Usar dados da transação mais recente
        paymentDate: latestTransaction?.paymentDate 
          ? latestTransaction.paymentDate.toISOString().split('T')[0] 
          : null,
        paymentForecastDate: latestTransaction?.paymentForecastDate 
          ? latestTransaction.paymentForecastDate.toISOString().split('T')[0] 
          : null,
        paymentStatus: latestTransaction?.paymentStatus || null,
        paymentType: latestTransaction?.paymentType || null,
        value: latestTransaction?.totalValue || null,
        age: calculateAge(student.birthDate)
      };
    });
    
    // Verifica o formato solicitado
    switch (format) {
      case ExportFormat.CSV:
        return handleCSVExport(res, processedStudents);
      
      case ExportFormat.EXCEL:
        return handleExcelExport(res, processedStudents);
      
      case ExportFormat.PDF:
        return handlePDFExport(res, processedStudents);
      
      default:
        throw new AppError(`Formato de exportação '${format}' não suportado`, 400, 'format', 'INVALID_EXPORT_FORMAT');
    }
    
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Constrói a cláusula WHERE do Prisma com base nos filtros
 */
const buildWhereClause = (
  filters: ReportFilters, 
  isAdmin: boolean, 
  userId: number
): Prisma.StudentWhereInput => {
  const where: Prisma.StudentWhereInput = {};
  
  // Se não for admin, só pode ver seus próprios alunos
  if (!isAdmin) {
    where.userId = userId;
  } else if (filters.userId) {
    // Se for admin e especificou userId, filtra por esse vendedor
    where.userId = filters.userId;
  }
  
  // Filtros básicos
  if (filters.fullName) where.fullName = { contains: filters.fullName, mode: 'insensitive' };
  if (filters.cpf) where.cpf = { contains: filters.cpf };
  if (filters.cnhType) where.cnhType = filters.cnhType;
  
  // Filtros de transação (agora precisamos usar a relação transactions)
  if (filters.courseId || filters.courseModalityId || filters.paymentStatus || filters.paymentType) {
    where.transactions = {
      some: {
        // Filtragem por campos de Transaction
        ...(filters.paymentStatus && { paymentStatus: filters.paymentStatus }),
        ...(filters.paymentType && { paymentType: filters.paymentType }),
        
        // Filtragem por relacionamento cursos nas transações
        ...(filters.courseId || filters.courseModalityId ? {
          courses: {
            some: {
              ...(filters.courseId && { courseId: Number(filters.courseId) }),
              ...(filters.courseModalityId && { courseModalityId: Number(filters.courseModalityId) })
            }
          }
        } : {})
      }
    };
  }
  
  // Filtro de datas
  if (filters.startDate || filters.endDate) {
    where.registrationDate = {
      ...(filters.startDate && { gte: filters.startDate }),
      ...(filters.endDate && { lte: filters.endDate })
    };
  }
  
  // Filtro de faixa de valor (agora usa transaction.totalValue)
  if (filters.minValue !== undefined || filters.maxValue !== undefined) {
    where.transactions = {
      ...(where.transactions || {}),
      some: {
        ...(where.transactions?.some || {}),
        totalValue: {
          ...(filters.minValue !== undefined && { gte: filters.minValue }),
          ...(filters.maxValue !== undefined && { lte: filters.maxValue })
        }
      }
    };
  }
  
  return where;
};

/**
 * Calcula a idade a partir da data de nascimento
 */
const calculateAge = (birthDate: Date | null): number | undefined => {
  if (!birthDate) return undefined;
  
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

/**
 * Constrói a cláusula ORDER BY do Prisma com base nos filtros
 */
const buildOrderByClause = (
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'desc'
): Prisma.StudentOrderByWithRelationInput => {
  if (!sortBy) {
    return { registrationDate: sortOrder };
  }
  
  const orderBy: Prisma.StudentOrderByWithRelationInput = {};
  
  switch (sortBy) {
    case 'value':
      // Não é possível ordenar diretamente pelo valor, pois agora está em Transaction
      // Ordenamos pela data de registro como fallback
      orderBy.registrationDate = sortOrder;
      break;
    case 'fullName':
      orderBy.fullName = sortOrder;
      break;
    case 'paymentStatus':
      // Não é possível ordenar diretamente pelo status, pois agora está em Transaction
      // Ordenamos pela data de registro como fallback
      orderBy.registrationDate = sortOrder;
      break;
    case 'registrationDate':
    default:
      orderBy.registrationDate = sortOrder;
      break;
  }
  
  return orderBy;
};

/**
 * Calcula totais e estatísticas dos alunos
 */
const calculateTotals = (students: Record<string, unknown>[]): ReportTotals => {
  const count = students.length;
  
  // Calcula o valor total e médio (agora usando transactions)
  const totalValue = students.reduce((sum, student) => {
    // Obter a transação mais recente
    const transactions = student.transactions as Array<any> | undefined;
    const latestTransaction = transactions && transactions.length > 0 ? transactions[0] : null;
    const value = latestTransaction && typeof latestTransaction.totalValue === 'number' 
      ? latestTransaction.totalValue 
      : 0;
    return sum + value;
  }, 0);
  
  const avgValue = count > 0 ? totalValue / count : 0;
  
  // Conta o total por status de pagamento
  const paymentStatusCounts: Record<string, number> = {};
  students.forEach(student => {
    // Obter status da transação mais recente
    const transactions = student.transactions as Array<any> | undefined;
    const latestTransaction = transactions && transactions.length > 0 ? transactions[0] : null;
    const status = latestTransaction?.paymentStatus as string;
    if (status) {
      paymentStatusCounts[status] = (paymentStatusCounts[status] || 0) + 1;
    }
  });
  
  // Conta o total por modalidade de curso
  const courseModalityIdCounts: Record<string, number> = {};
  students.forEach(student => {
    // Verificar se há transação com cursos
    const transactions = student.transactions as Array<any> | undefined;
    if (transactions && transactions.length > 0) {
      const courses = transactions[0].courses as Array<any> | undefined;
      if (courses && courses.length > 0) {
        courses.forEach(course => {
          if (course.courseModalityId) {
            const key = course.courseModalityId.toString();
            courseModalityIdCounts[key] = (courseModalityIdCounts[key] || 0) + 1;
          }
        });
      }
    }
  });
  
  return {
    count,
    totalValue,
    avgValue,
    paymentStatusCounts,
    courseModalityIdCounts
  };
};

/**
 * Agrupa resultados do relatório com base no critério especificado
 */
const groupResults = (students: Record<string, unknown>[], groupBy: string): GroupedReportResult[] => {
  const grouped: Record<string, {
    items: Record<string, unknown>[],
    totalValue: number
  }> = {};
  
  // Definições dos grupos
  let groupLabels: Record<string, string> = {};
  
  // Agrupa os resultados com base no critério
  for (const student of students) {
    let groupKey: string;
    
    switch (groupBy) {
      case 'paymentStatus':
        // Obter status da transação mais recente
        const transactions = student.transactions as Array<any> | undefined;
        const latestTransaction = transactions && transactions.length > 0 ? transactions[0] : null;
        groupKey = latestTransaction?.paymentStatus as string || 'Pendente';
        groupLabels = {
          'Pago': 'Pagos',
          'Pendente': 'Pendentes',
          'Parcial': 'Pagamento Parcial',
          'Cancelado': 'Cancelados'
        };
        break;
        
      case 'courseModalityId':
        // Obter modalidade da transação mais recente
        const transactionsModality = student.transactions as Array<any> | undefined;
        let modalityId = '';
        if (transactionsModality && transactionsModality.length > 0 && 
            transactionsModality[0].courses && transactionsModality[0].courses.length > 0) {
          modalityId = transactionsModality[0].courses[0].courseModalityId?.toString() || '';
        }
        groupKey = modalityId || 'sem-modalidade';
        // Labels serão preenchidos posteriormente com nomes das modalidades
        break;
        
      case 'courseId':
        // Obter curso da transação mais recente
        const transactionsCourse = student.transactions as Array<any> | undefined;
        let courseId = '';
        if (transactionsCourse && transactionsCourse.length > 0 && 
            transactionsCourse[0].courses && transactionsCourse[0].courses.length > 0) {
          courseId = transactionsCourse[0].courses[0].courseId?.toString() || '';
        }
        groupKey = courseId || 'sem-curso';
        // Labels serão preenchidos posteriormente com nomes dos cursos
        break;
        
      case 'paymentType':
        // Obter tipo de pagamento da transação mais recente
        const transactionsPayment = student.transactions as Array<any> | undefined;
        const latestTrans = transactionsPayment && transactionsPayment.length > 0 ? transactionsPayment[0] : null;
        groupKey = latestTrans?.paymentType as string || 'Desconhecido';
        groupLabels = {
          'Dinheiro': 'Dinheiro',
          'Cartão de Crédito': 'Cartão de Crédito',
          'Cartão de Débito': 'Cartão de Débito',
          'Boleto Bancário': 'Boleto',
          'PIX': 'PIX',
          'Transferência': 'Transferência'
        };
        break;
        
      case 'userId':
        groupKey = (student.userId as number).toString();
        break;
        
      case 'cnhType':
        groupKey = student.cnhType as string || 'Sem CNH';
        break;
        
      case 'month':
        // Agrupa por mês da data de registro
        const date = student.registrationDate as Date;
        if (date) {
          const month = date.getMonth() + 1;
          const year = date.getFullYear();
          groupKey = `${year}-${month.toString().padStart(2, '0')}`;
          // Nome dos meses em português
          const monthNames = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
          ];
          groupLabels[groupKey] = `${monthNames[month - 1]} ${year}`;
        } else {
          groupKey = 'sem-data';
          groupLabels[groupKey] = 'Sem data de registro';
        }
        break;
        
      case 'year':
        // Agrupa por ano da data de registro
        const regDate = student.registrationDate as Date;
        if (regDate) {
          groupKey = regDate.getFullYear().toString();
          groupLabels[groupKey] = `Ano ${groupKey}`;
        } else {
          groupKey = 'sem-data';
          groupLabels[groupKey] = 'Sem data de registro';
        }
        break;
        
      default:
        groupKey = 'outros';
        groupLabels[groupKey] = 'Outros';
    }
    
    // Inicializa o grupo se necessário
    if (!grouped[groupKey]) {
      grouped[groupKey] = {
        items: [],
        totalValue: 0
      };
    }
    
    // Adiciona o item ao grupo
    grouped[groupKey].items.push(student);
    
    // Soma o valor (da transação mais recente)
    const transactions = student.transactions as Array<any> | undefined;
    const latestTransaction = transactions && transactions.length > 0 ? transactions[0] : null;
    const value = latestTransaction && typeof latestTransaction.totalValue === 'number' 
      ? latestTransaction.totalValue 
      : 0;
    grouped[groupKey].totalValue += value;
  }
  
  // Converte o objeto agrupado em um array de resultados
  return Object.entries(grouped).map(([key, group]) => {
    const count = group.items.length;
    return {
      groupKey: key,
      groupLabel: groupLabels[key] || `Grupo ${key}`,
      count,
      totalValue: group.totalValue,
      avgValue: count > 0 ? group.totalValue / count : 0,
      items: group.items as unknown as ReportStudent[]
    };
  });
};

/**
 * Calcula estatísticas gerais a partir dos alunos
 */
const calculateOverallStatistics = (students: Record<string, unknown>[]): StatisticsResult['overall'] => {
  const totalStudents = students.length;
  
  // Calcula o valor total e médio
  const totalValue = students.reduce((sum, student) => {
    // Obter a transação mais recente
    const transactions = student.transactions as Array<any> | undefined;
    const latestTransaction = transactions && transactions.length > 0 ? transactions[0] : null;
    const value = latestTransaction && typeof latestTransaction.totalValue === 'number' 
      ? latestTransaction.totalValue 
      : 0;
    return sum + value;
  }, 0);
  
  const avgValue = totalStudents > 0 ? totalValue / totalStudents : 0;
  
  // Conta o total por status de pagamento
  const paymentStatusCounts: Record<string, number> = {};
  for (const student of students) {
    // Obter status da transação mais recente
    const transactions = student.transactions as Array<any> | undefined;
    const latestTransaction = transactions && transactions.length > 0 ? transactions[0] : null;
    const status = latestTransaction?.paymentStatus as string;
    if (status) {
      paymentStatusCounts[status] = (paymentStatusCounts[status] || 0) + 1;
    }
  }
  
  // Conta o total por modalidade de curso
  const courseModalityIdCounts: Record<string, number> = {};
  for (const student of students) {
    // Verificar se há transação com cursos
    const transactions = student.transactions as Array<any> | undefined;
    if (transactions && transactions.length > 0) {
      const courses = transactions[0].courses as Array<any> | undefined;
      if (courses && courses.length > 0) {
        for (const course of courses) {
          if (course.courseModalityId) {
            const key = course.courseModalityId.toString();
            courseModalityIdCounts[key] = (courseModalityIdCounts[key] || 0) + 1;
          }
        }
      }
    }
  }
  
  return {
    totalStudents,
    totalValue,
    avgValue,
    paymentStatusCounts,
    courseModalityIdCounts
  };
};

/**
 * Calcula estatísticas por período
 */
const calculatePeriodStatistics = (students: Record<string, unknown>[]): StatisticsResult['byPeriod'] => {
  const periodStats: Record<string, { count: number; totalValue: number }> = {};
  
  for (const student of students) {
    const date = new Date(student.registrationDate as string);
    const period = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    
    if (!periodStats[period]) {
      periodStats[period] = { count: 0, totalValue: 0 };
    }
    
    periodStats[period].count += 1;
    
    // Obter valor da transação mais recente
    const transactions = student.transactions as Array<any> | undefined;
    const latestTransaction = transactions && transactions.length > 0 ? transactions[0] : null;
    const value = latestTransaction && typeof latestTransaction.totalValue === 'number' 
      ? latestTransaction.totalValue 
      : 0;
    periodStats[period].totalValue += value;
  }
  
  return Object.entries(periodStats).map(([period, stats]) => ({
    period,
    count: stats.count,
    totalValue: stats.totalValue,
    avgValue: stats.count > 0 ? stats.totalValue / stats.count : 0
  })).sort((a, b) => b.period.localeCompare(a.period)); // Ordena por período decrescente
};

/**
 * Calcula estatísticas por vendedor
 */
const calculateSellerStatistics = (students: Record<string, unknown>[]): StatisticsResult['bySeller'] => {
  const sellerStats: Record<number, {
    seller: { id: number; name: string; email: string };
    count: number;
    totalValue: number;
    paymentStatusCounts: Record<string, number>;
  }> = {};
  
  for (const student of students) {
    const sellerId = student.userId as number;
    const createdBy = student.createdBy as Record<string, unknown>;
    
    if (!sellerStats[sellerId]) {
      sellerStats[sellerId] = {
        seller: {
          id: createdBy.id as number,
          name: createdBy.name as string,
          email: createdBy.email as string
        },
        count: 0,
        totalValue: 0,
        paymentStatusCounts: {}
      };
    }
    
    sellerStats[sellerId].count += 1;
    sellerStats[sellerId].totalValue += student.value as number;
    
    const paymentStatus = student.paymentStatus as string;
    const statusCount = sellerStats[sellerId].paymentStatusCounts[paymentStatus] || 0;
    sellerStats[sellerId].paymentStatusCounts[paymentStatus] = statusCount + 1;
  }
  
  return Object.values(sellerStats).map(stats => ({
    seller: stats.seller,
    count: stats.count,
    totalValue: stats.totalValue,
    avgValue: stats.count > 0 ? stats.totalValue / stats.count : 0,
    paymentStatusCounts: stats.paymentStatusCounts
  })).sort((a, b) => b.count - a.count); // Ordena por contagem decrescente
};

/**
 * Manipula a exportação CSV
 */
const handleCSVExport = (res: Response, students: Record<string, unknown>[]): Response => {
  // Define as colunas para o CSV
  const columns: ColumnDefinition[] = [
    { field: 'id', header: 'ID' },
    { field: 'registrationDate', header: 'Data de Registro', format: (value) => new Date(value as string).toLocaleDateString('pt-BR') },
    { field: 'fullName', header: 'Nome Completo' },
    { field: 'cpf', header: 'CPF', format: (value) => formatCPF(value as string) },
    { field: 'ddd', header: 'DDD' },
    { field: 'phone', header: 'Telefone' },
    { field: 'email', header: 'Email' },
    { field: 'birthDate', header: 'Data de Nascimento', format: (value) => value ? new Date(value as string).toLocaleDateString('pt-BR') : '' },
    { field: 'cnhNumber', header: 'Número CNH' },
    { field: 'cnhType', header: 'Categoria CNH' },
    { field: 'courseModalityId', header: 'Modalidade de Curso ID' },
    { field: 'courseId', header: 'Curso ID' },
    { field: 'value', header: 'Valor', format: (value) => formatValue(value as number) },
    { field: 'paymentType', header: 'Tipo de Pagamento' },
    { field: 'installments', header: 'Parcelas' },
    { field: 'paymentStatus', header: 'Status de Pagamento' },
    { field: 'createdBy.name', header: 'Vendedor' }
  ];
  
  // Gera o conteúdo CSV
  const csvHeader = columns.map(col => `"${col.header}"`).join(',');
  const csvRows = students.map(student => {
    return columns.map(col => {
      // Lida com campos aninhados como "createdBy.name"
      const fieldPath = col.field.split('.');
      let value: unknown = student;
      for (const path of fieldPath) {
        if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[path];
        } else {
          value = undefined;
          break;
        }
      }
      
      // Formata o valor se houver uma função de formatação
      const formattedValue = col.format && value !== null && value !== undefined 
        ? col.format(value) 
        : value === null || value === undefined ? '' : String(value);
      
      // Escapa aspas duplas e envolve em aspas
      return `"${formattedValue.toString().replace(/"/g, '""')}"`;
    }).join(',');
  }).join('\n');
  
  const csvContent = `${csvHeader}\n${csvRows}`;
  
  // Configura os headers da resposta para download do arquivo
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=relatorio_alunos.csv');
  
  // Retorna o conteúdo CSV
  return res.status(200).send(csvContent);
};

/**
 * Manipula a exportação EXCEL
 * 
 * Nota: Na implementação real, você usaria uma biblioteca como
 * exceljs ou xlsx para gerar um arquivo Excel real.
 * Esta é uma implementação simplificada que retorna CSV.
 */
const handleExcelExport = (res: Response, students: Record<string, unknown>[]): Response => {
  // Implementação simplificada - na implementação real, usaria uma biblioteca Excel
  return handleCSVExport(res, students);
};

/**
 * Manipula a exportação PDF
 * 
 * Nota: Na implementação real, você usaria uma biblioteca como 
 * PDFKit ou puppeteer para gerar um PDF adequado.
 * Esta é uma implementação simplificada que retorna JSON.
 */
const handlePDFExport = (res: Response, students: Record<string, unknown>[]): Response => {
  // Implementação simplificada - na implementação real, usaria uma biblioteca PDF
  return res.status(200).json({
    message: 'Exportação PDF ainda não implementada completamente. Utilize CSV ou Excel por enquanto.',
    data: students
  });
};

/**
 * Função para formatar CPF (000.000.000-00)
 */
const formatCPF = (cpf: string): string => {
  if (!cpf || cpf.length !== 11) return cpf;
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
};

/**
 * Função para formatar valor (R$ 0.000,00)
 */
const formatValue = (value: number): string => {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}; 