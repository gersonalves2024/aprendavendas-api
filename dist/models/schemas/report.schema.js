"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportFormat = exports.reportExportSchema = exports.reportFiltersSchema = void 0;
const zod_1 = require("zod");
/**
 * Schema para filtros avançados de relatórios
 */
exports.reportFiltersSchema = zod_1.z.object({
    // Filtros de aluno
    fullName: zod_1.z.string().optional(),
    cpf: zod_1.z.string().optional(),
    // Filtros de curso
    courseTypeId: zod_1.z.string().optional()
        .transform(val => val ? Number.parseInt(val, 10) : undefined)
        .refine(val => !val || (val > 0), {
        message: 'ID do tipo de curso deve ser maior que zero'
    }),
    courseId: zod_1.z.string().optional()
        .transform(val => val ? Number.parseInt(val, 10) : undefined)
        .refine(val => !val || (val > 0), {
        message: 'ID do curso deve ser maior que zero'
    }),
    // Filtros de período
    startDate: zod_1.z.string().optional()
        .refine(val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
        message: 'Data inicial deve estar no formato YYYY-MM-DD'
    })
        .transform(val => val ? new Date(val) : undefined)
        .refine(val => !val || (val instanceof Date && !Number.isNaN(val.getTime())), { message: 'Data inicial inválida' }),
    endDate: zod_1.z.string().optional()
        .refine(val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
        message: 'Data final deve estar no formato YYYY-MM-DD'
    })
        .transform(val => val ? new Date(val) : undefined)
        .refine(val => !val || (val instanceof Date && !Number.isNaN(val.getTime())), { message: 'Data final inválida' }),
    // Filtros de pagamento
    paymentStatus: zod_1.z.string().optional()
        .refine(val => !val || ['Pago', 'Pendente', 'Parcial', 'Cancelado'].includes(val), {
        message: 'Status de pagamento inválido. Deve ser: Pago, Pendente, Parcial ou Cancelado'
    }),
    paymentType: zod_1.z.string().optional()
        .refine(val => !val || [
        'Dinheiro',
        'Cartão de Crédito',
        'Cartão de Débito',
        'Boleto Bancário',
        'PIX',
        'Transferência'
    ].includes(val), {
        message: 'Tipo de pagamento inválido'
    }),
    // Novo: filtro por faixa de valor
    minValue: zod_1.z.string().optional()
        .transform(val => val ? Number.parseFloat(val.replace(',', '.')) : undefined)
        .refine(val => !val || (!Number.isNaN(val) && val >= 0), {
        message: 'Valor mínimo deve ser um número não negativo'
    }),
    maxValue: zod_1.z.string().optional()
        .transform(val => val ? Number.parseFloat(val.replace(',', '.')) : undefined)
        .refine(val => !val || (!Number.isNaN(val) && val >= 0), {
        message: 'Valor máximo deve ser um número não negativo'
    }),
    // Novo: filtro por vendedor
    userId: zod_1.z.string().optional()
        .transform(val => val ? Number.parseInt(val, 10) : undefined)
        .refine(val => !val || (val > 0), {
        message: 'ID do usuário deve ser maior que zero'
    }),
    // Novo: filtro por idade mínima/máxima do aluno
    minAge: zod_1.z.string().optional()
        .transform(val => val ? Number.parseInt(val, 10) : undefined)
        .refine(val => !val || (val >= 0 && val <= 120), {
        message: 'Idade mínima deve estar entre 0 e 120 anos'
    }),
    maxAge: zod_1.z.string().optional()
        .transform(val => val ? Number.parseInt(val, 10) : undefined)
        .refine(val => !val || (val >= 0 && val <= 120), {
        message: 'Idade máxima deve estar entre 0 e 120 anos'
    }),
    // Novo: filtro por tipo de CNH
    cnhType: zod_1.z.string().optional()
        .refine(val => !val || /^[A-E]{1,2}$/.test(val), {
        message: 'Tipo de CNH deve ser A, B, C, D, E ou combinações como AB'
    }),
    // Novo: agrupamento de resultados
    groupBy: zod_1.z.string().optional()
        .refine(val => !val || [
        'paymentStatus',
        'courseTypeId',
        'courseId',
        'paymentType',
        'userId',
        'cnhType',
        'month',
        'year'
    ].includes(val), {
        message: 'Agrupamento inválido'
    }),
    // Novo: ordenação de resultados
    sortBy: zod_1.z.string().optional()
        .refine(val => !val || [
        'value',
        'registrationDate',
        'fullName',
        'paymentStatus'
    ].includes(val), {
        message: 'Campo de ordenação inválido'
    }),
    sortOrder: zod_1.z.string().optional()
        .refine(val => !val || ['asc', 'desc'].includes(val), {
        message: 'Direção de ordenação deve ser asc ou desc'
    })
        .transform(val => val || 'desc'),
    // Parâmetros de paginação
    page: zod_1.z.string().optional()
        .transform(val => val ? Number.parseInt(val, 10) : 1)
        .refine(val => val > 0, {
        message: 'Página deve ser maior que zero'
    }),
    limit: zod_1.z.string().optional()
        .transform(val => val ? Number.parseInt(val, 10) : 10)
        .refine(val => val > 0 && val <= 100, {
        message: 'Limite deve estar entre 1 e 100'
    })
});
/**
 * Schema para exportação de relatórios
 */
exports.reportExportSchema = zod_1.z.object({
    format: zod_1.z.string()
        .refine(val => ['csv', 'excel', 'pdf'].includes(val), {
        message: 'Formato de exportação deve ser csv, excel ou pdf'
    }),
    // Inclui todos os filtros do schema de relatórios
    ...exports.reportFiltersSchema.shape
});
/**
 * Enum para formatos de exportação
 */
var ExportFormat;
(function (ExportFormat) {
    ExportFormat["CSV"] = "csv";
    ExportFormat["EXCEL"] = "excel";
    ExportFormat["PDF"] = "pdf";
})(ExportFormat || (exports.ExportFormat = ExportFormat = {}));
