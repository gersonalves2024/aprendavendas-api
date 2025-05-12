"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireOwnershipOrAdmin = exports.requireAdmin = exports.authenticate = void 0;
const jwt_1 = require("../utils/jwt");
const user_model_1 = require("../models/user.model");
const errorHandler_1 = require("../utils/errorHandler");
/**
 * Middleware para verificar se o usuário está autenticado
 */
const authenticate = (req, res, next) => {
    try {
        // Extrai o token do header de autorização
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new errorHandler_1.AppError('Token não fornecido ou formato inválido', 401, 'authorization', 'AUTH_HEADER_MISSING');
        }
        // Pega apenas o token (remove o "Bearer ")
        const token = authHeader.split(' ')[1];
        // Verifica e decodifica o token
        const decoded = (0, jwt_1.verifyToken)(token);
        if (!decoded) {
            throw new errorHandler_1.AppError('Token inválido ou expirado', 401, 'token', 'INVALID_TOKEN');
        }
        // Adiciona o usuário ao objeto de requisição para uso em outros middlewares ou controladores
        req.user = decoded;
        // Continua para o próximo middleware ou controlador
        next();
        return undefined;
    }
    catch (error) {
        return (0, errorHandler_1.handleError)(error, res);
    }
};
exports.authenticate = authenticate;
/**
 * Middleware para verificar se o usuário tem permissão de administrador
 */
const requireAdmin = (req, res, next) => {
    try {
        // Primeiro verifica se o usuário está autenticado
        if (!req.user) {
            throw new errorHandler_1.AppError('Usuário não autenticado. Por favor, faça login para continuar.', 401, undefined, 'AUTH_REQUIRED');
        }
        // Verifica se o usuário é um administrador
        if (req.user.role !== user_model_1.Role.ADMIN) {
            throw new errorHandler_1.AppError('Você não tem permissão de administrador para acessar este recurso.', 403, undefined, 'ADMIN_REQUIRED');
        }
        // Continua para o próximo middleware ou controlador
        next();
        return undefined;
    }
    catch (error) {
        return (0, errorHandler_1.handleError)(error, res);
    }
};
exports.requireAdmin = requireAdmin;
/**
 * Middleware para verificar se o usuário tem permissões de acesso a um recurso específico
 * (usado para permitir que vendedores acessem apenas seus próprios recursos)
 */
const requireOwnershipOrAdmin = (resourceIdParam) => {
    return (req, res, next) => {
        try {
            // Primeiro verifica se o usuário está autenticado
            if (!req.user) {
                throw new errorHandler_1.AppError('Usuário não autenticado. Por favor, faça login para continuar.', 401, undefined, 'AUTH_REQUIRED');
            }
            // Administradores têm acesso a todos os recursos
            if (req.user.role === user_model_1.Role.ADMIN) {
                next();
                return undefined;
            }
            // Para vendedores, verifica se o ID do recurso corresponde ao seu próprio ID
            const resourceId = req.params[resourceIdParam];
            const userId = req.user.userId.toString();
            if (resourceId && resourceId === userId) {
                next();
                return undefined;
            }
            // Se chegou aqui, o usuário não tem permissão
            throw new errorHandler_1.AppError('Você não tem permissão para acessar este recurso específico.', 403, undefined, 'PERMISSION_DENIED');
        }
        catch (error) {
            return (0, errorHandler_1.handleError)(error, res);
        }
    };
};
exports.requireOwnershipOrAdmin = requireOwnershipOrAdmin;
