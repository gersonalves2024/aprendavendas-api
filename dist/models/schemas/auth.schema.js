"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshTokenSchema = exports.loginSchema = exports.registerSchema = exports.PASSWORD_REGEX = void 0;
const zod_1 = require("zod");
const user_model_1 = require("../user.model");
/**
 * Regex para validação de senha forte
 * Deve conter pelo menos:
 * - 8 caracteres
 * - 1 letra maiúscula
 * - 1 letra minúscula
 * - 1 número
 * - 1 caractere especial
 */
exports.PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
/**
 * Schema para registro de usuário
 */
exports.registerSchema = zod_1.z.object({
    email: zod_1.z.string()
        .email({ message: 'Email inválido' })
        .min(1, { message: 'Email é obrigatório' }),
    password: zod_1.z.string()
        .min(8, { message: 'A senha deve ter pelo menos 8 caracteres' })
        .refine(value => exports.PASSWORD_REGEX.test(value), {
        message: 'A senha deve conter pelo menos uma letra maiúscula, uma minúscula, um número e um caractere especial'
    }),
    name: zod_1.z.string()
        .min(3, { message: 'O nome deve ter pelo menos 3 caracteres' })
        .max(100, { message: 'O nome não pode exceder 100 caracteres' })
        .refine(value => /^[A-zÀ-ú\s]+$/.test(value), {
        message: 'Nome deve conter apenas letras e espaços'
    }),
    role: zod_1.z.enum([user_model_1.Role.ADMIN, user_model_1.Role.SELLER])
        .optional()
        .default(user_model_1.Role.SELLER)
});
/**
 * Schema para login
 */
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string()
        .email({ message: 'Email inválido' })
        .min(1, { message: 'Email é obrigatório' }),
    password: zod_1.z.string()
        .min(1, { message: 'Senha é obrigatória' })
});
/**
 * Schema para refresh token
 */
exports.refreshTokenSchema = zod_1.z.object({
    refreshToken: zod_1.z.string()
        .min(1, { message: 'Refresh token é obrigatório' })
});
