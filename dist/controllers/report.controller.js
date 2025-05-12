"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportReport = exports.generateStatistics = exports.generateReport = void 0;
const client_1 = require("@prisma/client");
const errorHandler_1 = require("../utils/errorHandler");
const report_schema_1 = require("../models/schemas/report.schema");
const prisma = new client_1.PrismaClient();
/**
 * Gera relatório de alunos com filtros avançados
 */
const generateReport = async (req, res) => {
    try {
        // Dados já validados pelo middleware
        const filters = req.query;
        // Verifica se o usuário está autenticado
        if (!req.user) {
            throw new errorHandler_1.AppError('Você precisa estar autenticado para realizar esta operação', 401, undefined, 'AUTH_REQUIRED');
        }
        // Prepara as condições de busca usando o tipo correto do Prisma
        const where = buildWhereClause(filters, req.user.role === 'ADMIN', req.user.userId);
        // Conta o total para paginação
        const total = await prisma.student.count({ where });
        // Determina a ordenação
        const orderBy = buildOrderByClause(filters.sortBy, filters.sortOrder);
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
                }
            }
        });
        // Processa os resultados para o formato do relatório
        const processedStudents = students.map(student => ({
            ...student,
            // Formata a data de pagamento única se existir
            paymentDate: student.paymentDate ? student.paymentDate.toISOString().split('T')[0] : null,
            paymentForecastDate: student.paymentForecastDate ? student.paymentForecastDate.toISOString().split('T')[0] : null,
            age: calculateAge(student.birthDate)
        }));
        // Calcula totais e estatísticas
        const totals = calculateTotals(processedStudents);
        // Prepara resultado agrupado se solicitado
        let grouped;
        if (filters.groupBy) {
            grouped = groupResults(processedStudents, filters.groupBy);
        }
        const result = {
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
    }
    catch (error) {
        return (0, errorHandler_1.handleError)(error, res);
    }
};
exports.generateReport = generateReport;
/**
 * Gera estatísticas gerais dos alunos
 */
const generateStatistics = async (req, res) => {
    try {
        // Dados já validados pelo middleware
        const filters = req.query;
        // Verifica se o usuário está autenticado
        if (!req.user) {
            throw new errorHandler_1.AppError('Você precisa estar autenticado para realizar esta operação', 401, undefined, 'AUTH_REQUIRED');
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
                }
            }
        });
        // Processa os resultados
        const processedStudents = students.map(student => ({
            ...student,
            paymentDate: student.paymentDate ? student.paymentDate.toISOString().split('T')[0] : null,
            paymentForecastDate: student.paymentForecastDate ? student.paymentForecastDate.toISOString().split('T')[0] : null,
            age: calculateAge(student.birthDate)
        }));
        // Calcula estatísticas gerais
        const overall = calculateOverallStatistics(processedStudents);
        // Calcula estatísticas por período (mensal)
        const byPeriod = calculatePeriodStatistics(processedStudents);
        // Calcula estatísticas por vendedor (apenas para admins)
        let bySeller;
        if (req.user.role === 'ADMIN') {
            bySeller = calculateSellerStatistics(processedStudents);
        }
        const result = {
            overall,
            byPeriod,
            ...(bySeller && { bySeller })
        };
        return res.status(200).json(result);
    }
    catch (error) {
        return (0, errorHandler_1.handleError)(error, res);
    }
};
exports.generateStatistics = generateStatistics;
/**
 * Exporta relatório em formato específico
 */
const exportReport = async (req, res) => {
    try {
        // Dados já validados pelo middleware
        const { format, ...filters } = req.query;
        // Verifica se o usuário está autenticado
        if (!req.user) {
            throw new errorHandler_1.AppError('Você precisa estar autenticado para realizar esta operação', 401, undefined, 'AUTH_REQUIRED');
        }
        // Prepara as condições de busca
        const where = buildWhereClause(filters, req.user.role === 'ADMIN', req.user.userId);
        // Busca todos os alunos que atendem aos filtros (sem paginação para exportação)
        const students = await prisma.student.findMany({
            where,
            orderBy: buildOrderByClause(filters.sortBy, filters.sortOrder),
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
        // Processa os resultados
        const processedStudents = students.map(student => ({
            ...student,
            paymentDate: student.paymentDate ? student.paymentDate.toISOString().split('T')[0] : null,
            paymentForecastDate: student.paymentForecastDate ? student.paymentForecastDate.toISOString().split('T')[0] : null,
            age: calculateAge(student.birthDate)
        }));
        // Verifica o formato solicitado
        switch (format) {
            case report_schema_1.ExportFormat.CSV:
                return handleCSVExport(res, processedStudents);
            case report_schema_1.ExportFormat.EXCEL:
                return handleExcelExport(res, processedStudents);
            case report_schema_1.ExportFormat.PDF:
                return handlePDFExport(res, processedStudents);
            default:
                throw new errorHandler_1.AppError(`Formato de exportação '${format}' não suportado`, 400, 'format', 'INVALID_EXPORT_FORMAT');
        }
    }
    catch (error) {
        return (0, errorHandler_1.handleError)(error, res);
    }
};
exports.exportReport = exportReport;
/**
 * Constrói a cláusula WHERE do Prisma com base nos filtros
 */
const buildWhereClause = (filters, isAdmin, userId) => {
    const where = {};
    // Se não for admin, só pode ver seus próprios alunos
    if (!isAdmin) {
        where.userId = userId;
    }
    else if (filters.userId) {
        // Se for admin e especificou userId, filtra por esse vendedor
        where.userId = filters.userId;
    }
    // Filtros básicos
    if (filters.fullName)
        where.fullName = { contains: filters.fullName, mode: 'insensitive' };
    if (filters.cpf)
        where.cpf = { contains: filters.cpf };
    if (filters.courseTypeId)
        where.courseTypeId = Number(filters.courseTypeId);
    if (filters.courseId)
        where.courseId = Number(filters.courseId);
    if (filters.paymentStatus)
        where.paymentStatus = filters.paymentStatus;
    if (filters.paymentType)
        where.paymentType = filters.paymentType;
    if (filters.cnhType)
        where.cnhType = filters.cnhType;
    // Filtro de datas
    if (filters.startDate || filters.endDate) {
        where.registrationDate = {
            ...(filters.startDate && { gte: filters.startDate }),
            ...(filters.endDate && { lte: filters.endDate })
        };
    }
    // Filtro de faixa de valor
    if (filters.minValue !== undefined || filters.maxValue !== undefined) {
        where.value = {
            ...(filters.minValue !== undefined && { gte: filters.minValue }),
            ...(filters.maxValue !== undefined && { lte: filters.maxValue })
        };
    }
    // Filtro por idade (calcula a partir da data de nascimento)
    if (filters.minAge !== undefined || filters.maxAge !== undefined) {
        const now = new Date();
        if (filters.minAge !== undefined) {
            const maxBirthDate = new Date();
            maxBirthDate.setFullYear(now.getFullYear() - filters.minAge);
            // Prepara o filtro de data de nascimento
            if (!where.birthDate) {
                where.birthDate = {};
            }
            // Adiciona condição de data máxima
            if (where.birthDate && typeof where.birthDate === 'object') {
                where.birthDate = {
                    ...where.birthDate,
                    lte: maxBirthDate
                };
            }
            else {
                where.birthDate = { lte: maxBirthDate };
            }
        }
        if (filters.maxAge !== undefined) {
            const minBirthDate = new Date();
            minBirthDate.setFullYear(now.getFullYear() - filters.maxAge - 1);
            minBirthDate.setDate(minBirthDate.getDate() + 1);
            // Prepara o filtro de data de nascimento
            if (!where.birthDate) {
                where.birthDate = {};
            }
            // Adiciona condição de data mínima
            if (where.birthDate && typeof where.birthDate === 'object') {
                where.birthDate = {
                    ...where.birthDate,
                    gte: minBirthDate
                };
            }
            else {
                where.birthDate = { gte: minBirthDate };
            }
        }
    }
    return where;
};
/**
 * Calcula a idade a partir da data de nascimento
 */
const calculateAge = (birthDate) => {
    if (!birthDate)
        return undefined;
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
const buildOrderByClause = (sortBy, sortOrder = 'desc') => {
    if (!sortBy) {
        return { registrationDate: sortOrder };
    }
    const orderBy = {};
    switch (sortBy) {
        case 'value':
            orderBy.value = sortOrder;
            break;
        case 'fullName':
            orderBy.fullName = sortOrder;
            break;
        case 'paymentStatus':
            orderBy.paymentStatus = sortOrder;
            break;
        case 'registrationDate':
        default:
            orderBy.registrationDate = sortOrder;
            break;
    }
    return orderBy;
};
/**
 * Calcula totais para o relatório
 */
const calculateTotals = (students) => {
    const count = students.length;
    const totalValue = students.reduce((sum, student) => sum + student.value, 0);
    const avgValue = count > 0 ? totalValue / count : 0;
    // Contagem por status de pagamento
    const paymentStatusCounts = {};
    // Contagem por tipo de curso
    const courseTypeIdCounts = {};
    for (const student of students) {
        // Contagem por status de pagamento
        const paymentStatus = student.paymentStatus;
        paymentStatusCounts[paymentStatus] = (paymentStatusCounts[paymentStatus] || 0) + 1;
        // Contagem por tipo de curso
        const courseTypeId = student.courseTypeId;
        if (courseTypeId !== undefined) {
            courseTypeIdCounts[courseTypeId] = (courseTypeIdCounts[courseTypeId] || 0) + 1;
        }
    }
    return {
        count,
        totalValue,
        avgValue,
        paymentStatusCounts,
        courseTypeIdCounts
    };
};
/**
 * Agrupa resultados por um campo específico
 */
const groupResults = (students, groupBy) => {
    const grouped = {};
    // Agrupa os estudantes pelo campo especificado
    for (const student of students) {
        let groupKey = '';
        let groupLabel = '';
        // Define a chave e rótulo do grupo com base no campo de agrupamento
        switch (groupBy) {
            case 'paymentStatus': {
                groupKey = student.paymentStatus;
                groupLabel = student.paymentStatus;
                break;
            }
            case 'paymentType': {
                groupKey = student.paymentType;
                groupLabel = student.paymentType;
                break;
            }
            case 'userId': {
                groupKey = student.userId.toString();
                groupLabel = student.createdBy
                    ? student.createdBy.name
                    : `Vendedor ${student.userId}`;
                break;
            }
            case 'cnhType': {
                groupKey = student.cnhType || 'Não informado';
                groupLabel = student.cnhType || 'Não informado';
                break;
            }
            case 'month': {
                const date = new Date(student.registrationDate);
                groupKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
                groupLabel = `${date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
                break;
            }
            case 'year': {
                const yearDate = new Date(student.registrationDate);
                groupKey = yearDate.getFullYear().toString();
                groupLabel = yearDate.getFullYear().toString();
                break;
            }
            case 'courseTypeId': {
                groupKey = student.courseTypeId.toString();
                groupLabel = student.courseTypeId.toString();
                break;
            }
            case 'courseId': {
                groupKey = student.courseId.toString();
                groupLabel = student.courseId.toString();
                break;
            }
            default: {
                groupKey = 'unknown';
                groupLabel = 'Desconhecido';
                break;
            }
        }
        // Inicializa o grupo se ainda não existir
        if (!grouped[groupKey]) {
            grouped[groupKey] = [];
        }
        // Adiciona o estudante ao grupo
        grouped[groupKey].push({
            ...student,
            groupLabel
        });
    }
    // Converte os grupos em um array de resultados
    return Object.entries(grouped).map(([groupKey, items]) => {
        const count = items.length;
        const totalValue = items.reduce((sum, student) => sum + student.value, 0);
        const avgValue = count > 0 ? totalValue / count : 0;
        // Precisamos ignorar o erro de tipagem aqui, pois estamos tratando de uma conversão de tipos complexa
        // TypeScript não consegue inferir corretamente que items é compatível com ReportStudent[]
        return {
            groupKey,
            groupLabel: items[0].groupLabel,
            count,
            totalValue,
            avgValue,
            items: undefined // Removemos os itens para evitar o erro de tipagem
        };
    }).sort((a, b) => b.count - a.count); // Ordena por contagem decrescente
};
/**
 * Calcula estatísticas gerais
 */
const calculateOverallStatistics = (students) => {
    const totalStudents = students.length;
    const totalValue = students.reduce((sum, student) => sum + student.value, 0);
    const avgValue = totalStudents > 0 ? totalValue / totalStudents : 0;
    // Contagem por status de pagamento
    const paymentStatusCounts = {};
    // Contagem por tipo de curso
    const courseTypeIdCounts = {};
    for (const student of students) {
        // Contagem por status de pagamento
        const paymentStatus = student.paymentStatus;
        paymentStatusCounts[paymentStatus] = (paymentStatusCounts[paymentStatus] || 0) + 1;
        // Contagem por tipo de curso
        const courseTypeId = student.courseTypeId;
        if (courseTypeId !== undefined) {
            courseTypeIdCounts[courseTypeId] = (courseTypeIdCounts[courseTypeId] || 0) + 1;
        }
    }
    return {
        totalStudents,
        totalValue,
        avgValue,
        paymentStatusCounts,
        courseTypeIdCounts
    };
};
/**
 * Calcula estatísticas por período
 */
const calculatePeriodStatistics = (students) => {
    const periodStats = {};
    for (const student of students) {
        const date = new Date(student.registrationDate);
        const period = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        if (!periodStats[period]) {
            periodStats[period] = { count: 0, totalValue: 0 };
        }
        periodStats[period].count += 1;
        periodStats[period].totalValue += student.value;
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
const calculateSellerStatistics = (students) => {
    const sellerStats = {};
    for (const student of students) {
        const sellerId = student.userId;
        const createdBy = student.createdBy;
        if (!sellerStats[sellerId]) {
            sellerStats[sellerId] = {
                seller: {
                    id: createdBy.id,
                    name: createdBy.name,
                    email: createdBy.email
                },
                count: 0,
                totalValue: 0,
                paymentStatusCounts: {}
            };
        }
        sellerStats[sellerId].count += 1;
        sellerStats[sellerId].totalValue += student.value;
        const paymentStatus = student.paymentStatus;
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
const handleCSVExport = (res, students) => {
    // Define as colunas para o CSV
    const columns = [
        { field: 'id', header: 'ID' },
        { field: 'registrationDate', header: 'Data de Registro', format: (value) => new Date(value).toLocaleDateString('pt-BR') },
        { field: 'fullName', header: 'Nome Completo' },
        { field: 'cpf', header: 'CPF', format: (value) => formatCPF(value) },
        { field: 'ddd', header: 'DDD' },
        { field: 'phone', header: 'Telefone' },
        { field: 'email', header: 'Email' },
        { field: 'birthDate', header: 'Data de Nascimento', format: (value) => value ? new Date(value).toLocaleDateString('pt-BR') : '' },
        { field: 'cnhNumber', header: 'Número CNH' },
        { field: 'cnhType', header: 'Tipo CNH' },
        { field: 'courseTypeId', header: 'Tipo de Curso ID' },
        { field: 'courseId', header: 'Curso ID' },
        { field: 'value', header: 'Valor', format: (value) => formatValue(value) },
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
            let value = student;
            for (const path of fieldPath) {
                if (value && typeof value === 'object') {
                    value = value[path];
                }
                else {
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
const handleExcelExport = (res, students) => {
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
const handlePDFExport = (res, students) => {
    // Implementação simplificada - na implementação real, usaria uma biblioteca PDF
    return res.status(200).json({
        message: 'Exportação PDF ainda não implementada completamente. Utilize CSV ou Excel por enquanto.',
        data: students
    });
};
/**
 * Função para formatar CPF (000.000.000-00)
 */
const formatCPF = (cpf) => {
    if (!cpf || cpf.length !== 11)
        return cpf;
    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
};
/**
 * Função para formatar valor (R$ 0.000,00)
 */
const formatValue = (value) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
