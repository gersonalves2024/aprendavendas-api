import { z } from 'zod';
import { Role } from '../user.model';

/**
 * Regex para validação de senha forte
 * Deve conter pelo menos:
 * - 8 caracteres
 * - 1 letra maiúscula
 * - 1 letra minúscula
 * - 1 número
 * - 1 caractere especial
 */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

/**
 * Regex para validação de DDD
 * Formato válido: 2 dígitos
 */
export const DDD_REGEX = /^\d{2}$/;

/**
 * Regex para validação de número de telefone
 * Formatos válidos:
 * - 8 ou 9 dígitos (sem DDD)
 * - 10 ou 11 dígitos (com DDD)
 */
export const PHONE_REGEX = /^\d{8,11}$/;

/**
 * Schema para registro de usuário
 */
export const registerSchema = z.object({
  email: z.string()
    .email({ message: 'Email inválido' })
    .min(1, { message: 'Email é obrigatório' }),
  
  password: z.string()
    .min(8, { message: 'A senha deve ter pelo menos 8 caracteres' })
    .refine(value => PASSWORD_REGEX.test(value), {
      message: 'A senha deve conter pelo menos uma letra maiúscula, uma minúscula, um número e um caractere especial'
    }),
  
  name: z.string()
    .min(3, { message: 'O nome deve ter pelo menos 3 caracteres' })
    .max(100, { message: 'O nome não pode exceder 100 caracteres' })
    .refine(value => /^[A-zÀ-ú\s]+$/.test(value), { 
      message: 'Nome deve conter apenas letras e espaços' 
    }),
  
  ddd: z.string()
    .optional()
    .refine(value => !value || DDD_REGEX.test(value), {
      message: 'DDD deve conter 2 dígitos'
    }),
  
  phone: z.string()
    .optional()
    .refine(value => !value || PHONE_REGEX.test(value), {
      message: 'Telefone deve conter 8, 9, 10 ou 11 dígitos'
    }),
  
  role: z.enum([Role.ADMIN, Role.SELLER, Role.AFFILIATE])
    .optional()
    .default(Role.SELLER)
});

/**
 * Schema para login
 */
export const loginSchema = z.object({
  email: z.string()
    .email({ message: 'Email inválido' })
    .min(1, { message: 'Email é obrigatório' }),
  
  password: z.string()
    .min(1, { message: 'Senha é obrigatória' })
});

/**
 * Schema para refresh token
 */
export const refreshTokenSchema = z.object({
  refreshToken: z.string()
    .min(1, { message: 'Refresh token é obrigatório' })
}); 