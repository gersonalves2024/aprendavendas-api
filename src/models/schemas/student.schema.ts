import { z } from 'zod';

/**
 * Validação do CPF usando algoritmo dos dígitos verificadores
 */
export const isValidCPF = (cpf: string): boolean => {
  // Remove caracteres não numéricos
  const numericCPF = cpf.replace(/\D/g, '');
  
  // Verifica se o CPF tem 11 dígitos
  if (numericCPF.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais (CPF inválido, mas com formato correto)
  if (/^(\d)\1+$/.test(numericCPF)) return false;
  
  // Algoritmo de validação do CPF
  let sum = 0;
  let remainder: number;
  
  // Primeiro dígito verificador
  for (let i = 1; i <= 9; i++) {
    sum += Number.parseInt(numericCPF.substring(i - 1, i), 10) * (11 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== Number.parseInt(numericCPF.substring(9, 10), 10)) return false;
  
  // Segundo dígito verificador
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += Number.parseInt(numericCPF.substring(i - 1, i), 10) * (12 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== Number.parseInt(numericCPF.substring(10, 11), 10)) return false;
  
  return true;
};

/**
 * Schema base para os campos comuns entre criação e atualização
 */
const studentBaseSchema = {
  fullName: z.string().min(3, { message: 'Nome completo deve ter pelo menos 3 caracteres' })
    .max(100, { message: 'Nome completo não pode exceder 100 caracteres' })
    .refine(value => /^[A-zÀ-ú\s]+$/.test(value), { 
      message: 'Nome completo deve conter apenas letras e espaços' 
    }),
  
  ddd: z.string().length(2, { message: 'DDD deve ter exatamente 2 dígitos' })
    .refine(value => /^\d{2}$/.test(value), { 
      message: 'DDD deve conter apenas números' 
    }),
  
  phone: z.string().min(8, { message: 'Telefone deve ter pelo menos 8 dígitos' })
    .max(9, { message: 'Telefone não pode exceder 9 dígitos' })
    .refine(value => /^\d+$/.test(value), { 
      message: 'Telefone deve conter apenas números' 
    }),
  
  email: z.string().email({ message: 'Email inválido' }).optional().nullable()
    .transform(val => val === '' ? null : val),
  
  birthDate: z.union([
    z.string().optional().nullable()
      .refine(val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
        message: 'Data de nascimento deve estar no formato YYYY-MM-DD'
      })
      .transform(val => val ? new Date(val) : null),
    z.date().optional().nullable()
  ])
  .refine(
    val => !val || (val instanceof Date && !Number.isNaN(val.getTime())), 
    { message: 'Data de nascimento inválida' }
  ),
  
  cpf: z.string()
    .refine(value => /^\d{11}$/.test(value), { 
      message: 'CPF deve ter 11 dígitos numéricos, sem pontos ou traços' 
    })
    .refine(isValidCPF, { 
      message: 'CPF inválido. Por favor, verifique os dígitos.' 
    }),
  
  cnhNumber: z.string().optional().nullable()
    .refine(val => !val || /^\d+$/.test(val), { 
      message: 'Número da CNH deve conter apenas números' 
    })
    .transform(val => val === '' ? null : val),
  
  cnhType: z.string().optional().nullable()
    .refine(val => !val || /^[A-E]{1,2}$/.test(val), { 
      message: 'Tipo de CNH deve ser A, B, C, D, E ou combinações como AB' 
    })
    .transform(val => val === '' ? null : val),
  
  renach: z.string().optional().nullable()
    .transform(val => val === '' ? null : val),
  
  courseModalityId: z.number().int().positive({ message: 'Modalidade de curso é obrigatória' }),
  
  courseId: z.number().int().positive({ message: 'Nome do curso é obrigatório' }),
  
  value: z.number().positive({ message: 'Valor deve ser positivo' })
    .or(
      z.string().transform(val => Number.parseFloat(val.replace(',', '.')))
    )
    .refine(val => !Number.isNaN(val) && val > 0, { 
      message: 'Valor deve ser um número positivo' 
    }),
  
  paymentType: z.string().min(1, { message: 'Tipo de pagamento é obrigatório' })
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
  
  installments: z.number().int().positive({ message: 'Número de parcelas deve ser um inteiro positivo' })
    .or(
      z.string().transform(val => Number.parseInt(val, 10))
    )
    .refine(val => !Number.isNaN(val) && val > 0 && val <= 12, { 
      message: 'Número de parcelas deve ser um inteiro entre 1 e 12' 
    }),
  
  paymentStatus: z.string().min(1, { message: 'Status de pagamento é obrigatório' })
    .refine(val => ['Pago', 'Pendente', 'Parcial', 'Cancelado'].includes(val), {
      message: 'Status de pagamento inválido. Deve ser: Pago, Pendente, Parcial ou Cancelado'
    }),
};

/**
 * Schema para criação de aluno
 */
const createStudentBaseSchema = z.object({
  ...studentBaseSchema,
  // Campos obrigatórios apenas na criação
  fullName: studentBaseSchema.fullName,
  ddd: studentBaseSchema.ddd,
  phone: studentBaseSchema.phone,
  cpf: studentBaseSchema.cpf,
  courseModalityId: studentBaseSchema.courseModalityId,
  courseId: studentBaseSchema.courseId,
  value: studentBaseSchema.value,
  paymentType: studentBaseSchema.paymentType,
  installments: studentBaseSchema.installments,
  paymentStatus: studentBaseSchema.paymentStatus,
  // Adicionar campos de data explicitamente
  paymentDate: z.union([
    z.string().optional().nullable()
      .refine(val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
        message: 'Data de pagamento deve estar no formato YYYY-MM-DD'
      })
      .transform(val => val ? new Date(val) : null),
    z.date().optional().nullable()
  ]),
  
  paymentForecastDate: z.union([
    z.string().optional().nullable()
      .refine(val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
        message: 'Data de previsão de pagamento deve estar no formato YYYY-MM-DD'
      })
      .transform(val => val ? new Date(val) : null),
    z.date().optional().nullable()
  ])
});

// Adiciona refinamento de validação para verificar a compatibilidade entre status e data de pagamento
const validatePaymentDate = (data: { paymentStatus?: string; paymentDate?: Date | null }) => {
  if ((data.paymentStatus === 'Pendente' || data.paymentStatus === 'Cancelado') && 
      data.paymentDate !== null && data.paymentDate !== undefined) {
    return false;
  }
  return true;
};

// Cria o schema final com validação personalizada
export const createStudentSchema = createStudentBaseSchema
  .superRefine((data, ctx) => {
    if (!validatePaymentDate(data)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Alunos com status Pendente ou Cancelado não podem ter data de pagamento',
        path: ['paymentDate']
      });
    }
  });

/**
 * Tipo auxiliar para lidar com esquemas Zod
 */
type ZodSchema = z.ZodTypeAny;

/**
 * Schema para atualização de aluno (todos os campos são opcionais)
 */
const updateStudentBaseSchema = z.object({
  fullName: studentBaseSchema.fullName.optional(),
  ddd: studentBaseSchema.ddd.optional(),
  phone: studentBaseSchema.phone.optional(),
  email: studentBaseSchema.email.optional(),
  birthDate: z.union([
    z.string().optional().nullable(),
    z.date().optional().nullable()
  ]),
  cpf: studentBaseSchema.cpf.optional(),
  cnhNumber: studentBaseSchema.cnhNumber.optional(),
  cnhType: studentBaseSchema.cnhType.optional(),
  renach: studentBaseSchema.renach.optional(),
  courseModalityId: studentBaseSchema.courseModalityId.optional(),
  courseId: studentBaseSchema.courseId.optional(),
  value: studentBaseSchema.value.optional(),
  paymentType: studentBaseSchema.paymentType.optional(),
  installments: studentBaseSchema.installments.optional(),
  paymentStatus: studentBaseSchema.paymentStatus.optional(),
  paymentDate: z.union([
    z.string().optional().nullable()
      .refine(val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
        message: 'Data de pagamento deve estar no formato YYYY-MM-DD'
      })
      .transform(val => val ? new Date(val) : null),
    z.date().optional().nullable()
  ]),
  
  paymentForecastDate: z.union([
    z.string().optional().nullable()
      .refine(val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
        message: 'Data de previsão de pagamento deve estar no formato YYYY-MM-DD'
      })
      .transform(val => val ? new Date(val) : null),
    z.date().optional().nullable()
  ])
});

// Cria o schema final com validação personalizada
export const updateStudentSchema = updateStudentBaseSchema
  .superRefine((data, ctx) => {
    // Somente validar se AMBOS o status e a data de pagamento foram fornecidos
    // Se estamos alterando o status para Pago, é válido incluir a data de pagamento
    if (data.paymentStatus && data.paymentDate) {
      if ((data.paymentStatus === 'Pendente' || data.paymentStatus === 'Cancelado') && 
           data.paymentDate !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Alunos com status Pendente ou Cancelado não podem ter data de pagamento',
          path: ['paymentDate']
        });
      }
    }
  });

/**
 * Schema para paginação
 */
export const paginationSchema = z.object({
  page: z.string().optional()
    .transform(val => val ? Number.parseInt(val, 10) : 1)
    .refine(val => val > 0, { message: 'Página deve ser maior que zero' }),
  
  limit: z.string().optional()
    .transform(val => val ? Number.parseInt(val, 10) : 10)
    .refine(val => val > 0 && val <= 100, { message: 'Limite deve estar entre 1 e 100' })
});

/**
 * Schema para filtros
 */
export const filtersSchema = z.object({
  fullName: z.string().optional(),
  cpf: z.string().optional(),
  courseType: z.string().optional(),
  courseName: z.string().optional(),
  paymentStatus: z.string().optional(),
  userId: z.string().optional()
    .transform(val => val ? Number.parseInt(val, 10) : undefined)
    .refine(val => !val || (val > 0), { message: 'ID do usuário deve ser maior que zero' }),
  
  startDate: z.string().optional()
    .refine(val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
      message: 'Data inicial deve estar no formato YYYY-MM-DD'
    })
    .transform(val => val ? new Date(val) : undefined)
    .refine(
      val => !val || (val instanceof Date && !Number.isNaN(val.getTime())), 
      { message: 'Data inicial inválida' }
    ),
  
  endDate: z.string().optional()
    .refine(val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
      message: 'Data final deve estar no formato YYYY-MM-DD'
    })
    .transform(val => val ? new Date(val) : undefined)
    .refine(
      val => !val || (val instanceof Date && !Number.isNaN(val.getTime())), 
      { message: 'Data final inválida' }
    )
}); 