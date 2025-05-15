import { z } from 'zod';
import { CouponApplicationMode } from '@prisma/client';

// Schema para geração de novo cupom para afiliado
export const createCouponSchema = z.object({
  userId: z.number().int().positive({ message: 'ID de usuário inválido' }).optional(),
  userType: z.enum(['AFFILIATE', 'SELLER', 'NONE'], { 
    required_error: 'Tipo de usuário é obrigatório',
    invalid_type_error: 'Tipo de usuário deve ser AFFILIATE, SELLER ou NONE'
  }),
  customName: z.string().optional(),
  expirationDate: z.string()
    .optional()
    .refine(val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
      message: 'Data de expiração deve estar no formato YYYY-MM-DD'
    }),
  usageLimit: z.number().int().positive({ message: 'Limite de uso deve ser um número positivo' }).optional(),
}).refine((data) => {
  // Se userType não for NONE, userId é obrigatório
  if (data.userType !== 'NONE' && !data.userId) {
    return false;
  }
  return true;
}, {
  message: 'ID de usuário é obrigatório quando o tipo não é NONE',
  path: ['userId']
});

// Schema para configuração de cupom no modo geral
export const generalCouponConfigSchema = z.object({
  couponId: z.number().int().positive({ message: 'ID de cupom inválido' }),
  courseModalityId: z.number().int().positive({ message: 'ID de modalidade inválido' }),
  discountValue: z.number().positive({ message: 'Valor de desconto deve ser positivo' }).optional().nullable(),
  discountPercent: z.number()
    .min(0, { message: 'Percentual de desconto deve ser maior ou igual a 0' })
    .max(100, { message: 'Percentual de desconto deve ser menor ou igual a 100' })
    .optional()
    .nullable(),
  commissionValue: z.number().positive({ message: 'Valor de comissão deve ser positivo' }).optional().nullable(),
  commissionPercent: z.number()
    .min(0, { message: 'Percentual de comissão deve ser maior ou igual a 0' })
    .max(100, { message: 'Percentual de comissão deve ser menor ou igual a 100' })
    .optional()
    .nullable(),
}).refine(
  data => (data.discountValue !== null && data.discountValue !== undefined) || 
          (data.discountPercent !== null && data.discountPercent !== undefined),
  { message: 'É necessário definir um valor de desconto fixo ou percentual', path: ['discountValue'] }
).refine(
  data => (data.commissionValue !== null && data.commissionValue !== undefined) || 
          (data.commissionPercent !== null && data.commissionPercent !== undefined),
  { message: 'É necessário definir um valor de comissão fixo ou percentual', path: ['commissionValue'] }
).refine(
  data => !(data.discountValue !== null && data.discountValue !== undefined && 
            data.discountPercent !== null && data.discountPercent !== undefined),
  { message: 'Não é possível definir desconto fixo e percentual ao mesmo tempo', path: ['discountValue'] }
).refine(
  data => !(data.commissionValue !== null && data.commissionValue !== undefined && 
            data.commissionPercent !== null && data.commissionPercent !== undefined),
  { message: 'Não é possível definir comissão fixa e percentual ao mesmo tempo', path: ['commissionValue'] }
);

// Schema para configuração de cupom no modo específico
export const specificCouponConfigSchema = z.object({
  couponId: z.number().int().positive({ message: 'ID de cupom inválido' }),
  courseId: z.number().int().positive({ message: 'ID de curso inválido' }),
  discountValue: z.number().positive({ message: 'Valor de desconto deve ser positivo' }).optional().nullable(),
  discountPercent: z.number()
    .min(0, { message: 'Percentual de desconto deve ser maior ou igual a 0' })
    .max(100, { message: 'Percentual de desconto deve ser menor ou igual a 100' })
    .optional()
    .nullable(),
  commissionValue: z.number().positive({ message: 'Valor de comissão deve ser positivo' }).optional().nullable(),
  commissionPercent: z.number()
    .min(0, { message: 'Percentual de comissão deve ser maior ou igual a 0' })
    .max(100, { message: 'Percentual de comissão deve ser menor ou igual a 100' })
    .optional()
    .nullable(),
}).refine(
  data => (data.discountValue !== null && data.discountValue !== undefined) || 
          (data.discountPercent !== null && data.discountPercent !== undefined),
  { message: 'É necessário definir um valor de desconto fixo ou percentual', path: ['discountValue'] }
).refine(
  data => (data.commissionValue !== null && data.commissionValue !== undefined) || 
          (data.commissionPercent !== null && data.commissionPercent !== undefined),
  { message: 'É necessário definir um valor de comissão fixo ou percentual', path: ['commissionValue'] }
).refine(
  data => !(data.discountValue !== null && data.discountValue !== undefined && 
            data.discountPercent !== null && data.discountPercent !== undefined),
  { message: 'Não é possível definir desconto fixo e percentual ao mesmo tempo', path: ['discountValue'] }
).refine(
  data => !(data.commissionValue !== null && data.commissionValue !== undefined && 
            data.commissionPercent !== null && data.commissionPercent !== undefined),
  { message: 'Não é possível definir comissão fixa e percentual ao mesmo tempo', path: ['commissionValue'] }
);

// Schema para atualização de modo de aplicação do cupom
export const updateCouponApplicationModeSchema = z.object({
  couponId: z.number().int().positive({ message: 'ID de cupom inválido' }),
  applicationMode: z.nativeEnum(CouponApplicationMode, {
    errorMap: () => ({ message: 'Modo de aplicação deve ser GENERAL ou SPECIFIC' })
  }),
});

// Schema para validação de aplicação de cupom
export const validateCouponSchema = z.object({
  code: z.string().min(1, { message: 'Código do cupom é obrigatório' }),
  courseId: z.number().int().positive({ message: 'ID de curso inválido' }),
  courseModalityId: z.number().int().positive({ message: 'ID de modalidade inválido' }),
  value: z.number().positive({ message: 'Valor deve ser positivo' }),
}); 