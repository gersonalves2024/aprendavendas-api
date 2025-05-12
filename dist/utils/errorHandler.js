"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleError = exports.handleZodError = exports.handlePrismaError = exports.AppError = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
/**
 * Classe de erro customizada para tratamento de erros de negócio
 */
class AppError extends Error {
    constructor(message, statusCode = 400, field, code, details) {
        super(message);
        this.statusCode = statusCode;
        this.field = field;
        this.code = code;
        this.details = details;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
/**
 * Função para tratar erros do Prisma
 */
const handlePrismaError = (error) => {
    // Erro de violação de chave única (ex: email já cadastrado)
    if (error.code === 'P2002') {
        const field = Array.isArray(error.meta?.target)
            ? (error.meta?.target)[0]
            : 'campo';
        return {
            error: 'Conflito de dados',
            message: `Já existe um registro com este ${field}`,
            field,
            code: error.code
        };
    }
    // Erro de registro não encontrado
    if (error.code === 'P2025') {
        return {
            error: 'Registro não encontrado',
            message: 'O registro solicitado não foi encontrado',
            code: error.code
        };
    }
    // Erro de validação de dados
    if (error.code === 'P2003') {
        return {
            error: 'Erro de validação',
            message: 'Falha na validação dos dados fornecidos',
            code: error.code
        };
    }
    // Erro genérico do Prisma
    return {
        error: 'Erro de banco de dados',
        message: 'Ocorreu um erro ao acessar o banco de dados',
        code: error.code
    };
};
exports.handlePrismaError = handlePrismaError;
/**
 * Função para tratar erros de validação do Zod
 */
const handleZodError = (error) => {
    const formattedErrors = {};
    for (const err of error.errors) {
        const pathStr = err.path.map(p => String(p)).join('.');
        formattedErrors[pathStr] = {
            message: err.message,
            path: err.path.map(p => String(p))
        };
    }
    return {
        error: 'Erro de validação',
        message: 'Os dados fornecidos não são válidos',
        details: formattedErrors
    };
};
exports.handleZodError = handleZodError;
/**
 * Função principal para tratamento de erros
 */
const handleError = (error, res) => {
    console.error('Erro capturado:', error);
    // Erro de aplicação
    if (error instanceof AppError) {
        return res.status(error.statusCode).json({
            error: error.name,
            message: error.message,
            field: error.field,
            code: error.code,
            details: error.details
        });
    }
    // Erro do Prisma
    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        const errorResponse = (0, exports.handlePrismaError)(error);
        return res.status(400).json(errorResponse);
    }
    // Erro do Zod
    if (error instanceof zod_1.ZodError) {
        const errorResponse = (0, exports.handleZodError)(error);
        return res.status(400).json(errorResponse);
    }
    // Erro de JWT
    if (error instanceof Error && error.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Token inválido',
            message: 'O token fornecido é inválido ou foi adulterado'
        });
    }
    // Erro de expiração de JWT
    if (error instanceof Error && error.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: 'Token expirado',
            message: 'O token expirou. Por favor, faça login novamente'
        });
    }
    // Erro genérico
    return res.status(500).json({
        error: 'Erro interno do servidor',
        message: 'Ocorreu um erro inesperado. Por favor, tente novamente mais tarde.'
    });
};
exports.handleError = handleError;
