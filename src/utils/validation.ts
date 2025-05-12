import type { ZodSchema } from 'zod';

/**
 * Valida os dados recebidos contra um schema Zod
 * @param data Dados a serem validados
 * @param schema Schema Zod para validação
 * @returns Objeto com resultado da validação (success e error se houver)
 */
export function validateRequestBody<T>(data: unknown, schema: ZodSchema<T>) {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'errors' in error && Array.isArray(error.errors)) {
      const errorMessages = error.errors.map((err: { path: string[]; message: string }) => {
        return `${err.path.join('.')}: ${err.message}`;
      });
      return { success: false, error: errorMessages.join(', ') };
    }
    return { success: false, error: 'Erro de validação nos dados fornecidos' };
  }
} 