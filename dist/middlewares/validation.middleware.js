"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const zod_1 = require("zod");
/**
 * Middleware para validar os dados de entrada usando um schema Zod
 * @param schema - O schema Zod para validar os dados
 * @param source - A fonte dos dados a serem validados (body, query, params)
 */
const validate = (schema, source = 'body') => {
    return (req, res, next) => {
        try {
            const data = req[source];
            const validationResult = schema.safeParse(data);
            if (!validationResult.success) {
                const formattedErrors = formatZodErrors(validationResult.error);
                return res.status(400).json({
                    error: `Dados de ${sourceToDescription(source)} inválidos`,
                    details: formattedErrors
                });
            }
            // Atualiza os dados da requisição com os dados validados e transformados pelo Zod
            req[source] = validationResult.data;
            return next();
        }
        catch (error) {
            console.error(`Erro na validação de ${source}:`, error);
            if (error instanceof zod_1.ZodError) {
                const formattedErrors = formatZodErrors(error);
                return res.status(400).json({
                    error: `Dados de ${sourceToDescription(source)} inválidos`,
                    details: formattedErrors
                });
            }
            return res.status(500).json({
                error: 'Erro durante a validação dos dados',
                details: error instanceof Error ? error.message : 'Erro desconhecido'
            });
        }
    };
};
exports.validate = validate;
/**
 * Formata os erros Zod para um formato mais amigável
 */
const formatZodErrors = (error) => {
    const result = {};
    for (const err of error.errors) {
        const pathStr = err.path.map(p => String(p)).join('.');
        result[pathStr] = {
            message: err.message,
            path: err.path.map(p => String(p))
        };
    }
    return result;
};
/**
 * Converte a fonte dos dados para uma descrição mais amigável
 */
const sourceToDescription = (source) => {
    switch (source) {
        case 'body':
            return 'corpo da requisição';
        case 'query':
            return 'parâmetros de consulta';
        case 'params':
            return 'parâmetros de rota';
        default:
            return source;
    }
};
