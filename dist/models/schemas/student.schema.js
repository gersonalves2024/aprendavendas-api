"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filtersSchema = exports.paginationSchema = exports.updateStudentSchema = exports.createStudentSchema = exports.isValidCPF = void 0;
const zod_1 = require("zod");
/**
 * Validação do CPF usando algoritmo dos dígitos verificadores
 */
const isValidCPF = (cpf) => {
    // Remove caracteres não numéricos
    const numericCPF = cpf.replace(/\D/g, '');
    // Verifica se o CPF tem 11 dígitos
    if (numericCPF.length !== 11)
        return false;
    // Verifica se todos os dígitos são iguais (CPF inválido, mas com formato correto)
    if (/^(\d)\1+$/.test(numericCPF))
        return false;
    // Algoritmo de validação do CPF
    let sum = 0;
    let remainder;
    // Primeiro dígito verificador
    for (let i = 1; i <= 9; i++) {
        sum += Number.parseInt(numericCPF.substring(i - 1, i), 10) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11)
        remainder = 0;
    if (remainder !== Number.parseInt(numericCPF.substring(9, 10), 10))
        return false;
    // Segundo dígito verificador
    sum = 0;
    for (let i = 1; i <= 10; i++) {
        sum += Number.parseInt(numericCPF.substring(i - 1, i), 10) * (12 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11)
        remainder = 0;
    if (remainder !== Number.parseInt(numericCPF.substring(10, 11), 10))
        return false;
    return true;
};
exports.isValidCPF = isValidCPF;
/**
 * Schema base para os campos comuns entre criação e atualização
 */
const studentBaseSchema = {
    fullName: zod_1.z.string().min(3, { message: 'Nome completo deve ter pelo menos 3 caracteres' })
        .max(100, { message: 'Nome completo não pode exceder 100 caracteres' })
        .refine(value => /^[A-zÀ-ú\s]+$/.test(value), {
        message: 'Nome completo deve conter apenas letras e espaços'
    }),
    ddd: zod_1.z.string().length(2, { message: 'DDD deve ter exatamente 2 dígitos' })
        .refine(value => /^\d{2}$/.test(value), {
        message: 'DDD deve conter apenas números'
    }),
    phone: zod_1.z.string().min(8, { message: 'Telefone deve ter pelo menos 8 dígitos' })
        .max(9, { message: 'Telefone não pode exceder 9 dígitos' })
        .refine(value => /^\d+$/.test(value), {
        message: 'Telefone deve conter apenas números'
    }),
    email: zod_1.z.string().email({ message: 'Email inválido' }).optional().nullable()
        .transform(val => val === '' ? null : val),
    birthDate: zod_1.z.string().optional().nullable()
        .refine(val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
        message: 'Data de nascimento deve estar no formato YYYY-MM-DD'
    })
        .transform(val => val ? new Date(val) : null)
        .refine(val => !val || (val instanceof Date && !Number.isNaN(val.getTime())), { message: 'Data de nascimento inválida' }),
    cpf: zod_1.z.string()
        .refine(value => /^\d{11}$/.test(value), {
        message: 'CPF deve ter 11 dígitos numéricos, sem pontos ou traços'
    })
        .refine(exports.isValidCPF, {
        message: 'CPF inválido. Por favor, verifique os dígitos.'
    }),
    cnhNumber: zod_1.z.string().optional().nullable()
        .refine(val => !val || /^\d+$/.test(val), {
        message: 'Número da CNH deve conter apenas números'
    })
        .transform(val => val === '' ? null : val),
    cnhType: zod_1.z.string().optional().nullable()
        .refine(val => !val || /^[A-E]{1,2}$/.test(val), {
        message: 'Tipo de CNH deve ser A, B, C, D, E ou combinações como AB'
    })
        .transform(val => val === '' ? null : val),
    renach: zod_1.z.string().optional().nullable()
        .transform(val => val === '' ? null : val),
    courseTypeId: zod_1.z.number().int().positive({ message: 'Tipo de curso é obrigatório' }),
    courseId: zod_1.z.number().int().positive({ message: 'Nome do curso é obrigatório' }),
    value: zod_1.z.number().positive({ message: 'Valor deve ser positivo' })
        .or(zod_1.z.string().transform(val => Number.parseFloat(val.replace(',', '.'))))
        .refine(val => !Number.isNaN(val) && val > 0, {
        message: 'Valor deve ser um número positivo'
    }),
    paymentType: zod_1.z.string().min(1, { message: 'Tipo de pagamento é obrigatório' })
        .refine(val => [
        'Dinheiro',
        'Cartão de Crédito',
        'Cartão de Débito',
        'Boleto Bancário',
        'PIX',
        'Transferência'
    ].includes(val), {
        message: 'Tipo de pagamento inválido'
    }),
    installments: zod_1.z.number().int().positive({ message: 'Número de parcelas deve ser um inteiro positivo' })
        .or(zod_1.z.string().transform(val => Number.parseInt(val, 10)))
        .refine(val => !Number.isNaN(val) && val > 0 && val <= 12, {
        message: 'Número de parcelas deve ser um inteiro entre 1 e 12'
    }),
    paymentStatus: zod_1.z.string().min(1, { message: 'Status de pagamento é obrigatório' })
        .refine(val => ['Pago', 'Pendente', 'Parcial', 'Cancelado'].includes(val), {
        message: 'Status de pagamento inválido. Deve ser: Pago, Pendente, Parcial ou Cancelado'
    }),
};
/**
 * Schema para criação de aluno
 */
exports.createStudentSchema = zod_1.z.object({
    ...studentBaseSchema,
    // Campos obrigatórios apenas na criação
    fullName: studentBaseSchema.fullName,
    ddd: studentBaseSchema.ddd,
    phone: studentBaseSchema.phone,
    cpf: studentBaseSchema.cpf,
    courseTypeId: studentBaseSchema.courseTypeId,
    courseId: studentBaseSchema.courseId,
    value: studentBaseSchema.value,
    paymentType: studentBaseSchema.paymentType,
    installments: studentBaseSchema.installments,
    paymentStatus: studentBaseSchema.paymentStatus
});
/**
 * Schema para atualização de aluno (todos os campos são opcionais)
 */
exports.updateStudentSchema = zod_1.z.object({
    ...Object.entries(studentBaseSchema).reduce((acc, [key, schema]) => {
        acc[key] = schema.optional();
        return acc;
    }, {})
}).partial();
/**
 * Schema para paginação
 */
exports.paginationSchema = zod_1.z.object({
    page: zod_1.z.string().optional()
        .transform(val => val ? Number.parseInt(val, 10) : 1)
        .refine(val => val > 0, { message: 'Página deve ser maior que zero' }),
    limit: zod_1.z.string().optional()
        .transform(val => val ? Number.parseInt(val, 10) : 10)
        .refine(val => val > 0 && val <= 100, { message: 'Limite deve estar entre 1 e 100' })
});
/**
 * Schema para filtros
 */
exports.filtersSchema = zod_1.z.object({
    fullName: zod_1.z.string().optional(),
    cpf: zod_1.z.string().optional(),
    courseType: zod_1.z.string().optional(),
    courseName: zod_1.z.string().optional(),
    paymentStatus: zod_1.z.string().optional(),
    userId: zod_1.z.string().optional()
        .transform(val => val ? Number.parseInt(val, 10) : undefined)
        .refine(val => !val || (val > 0), { message: 'ID do usuário deve ser maior que zero' }),
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
        .refine(val => !val || (val instanceof Date && !Number.isNaN(val.getTime())), { message: 'Data final inválida' })
});
