"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestBody = validateRequestBody;
/**
 * Valida os dados recebidos contra um schema Zod
 * @param data Dados a serem validados
 * @param schema Schema Zod para validação
 * @returns Objeto com resultado da validação (success e error se houver)
 */
function validateRequestBody(data, schema) {
    try {
        const validatedData = schema.parse(data);
        return { success: true, data: validatedData };
    }
    catch (error) {
        if (error && typeof error === 'object' && 'errors' in error && Array.isArray(error.errors)) {
            const errorMessages = error.errors.map((err) => {
                return `${err.path.join('.')}: ${err.message}`;
            });
            return { success: false, error: errorMessages.join(', ') };
        }
        return { success: false, error: 'Erro de validação nos dados fornecidos' };
    }
}
