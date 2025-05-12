"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.refreshToken = exports.login = exports.register = void 0;
const client_1 = require("@prisma/client");
const password_1 = require("../utils/password");
const jwt_1 = require("../utils/jwt");
const user_model_1 = require("../models/user.model");
const errorHandler_1 = require("../utils/errorHandler");
const prisma = new client_1.PrismaClient();
/**
 * Registra um novo usuário
 */
const register = async (req, res) => {
    try {
        // A validação já foi feita pelo middleware
        const userData = req.body;
        const { email, password, name, role = user_model_1.Role.SELLER } = userData;
        // Verifica se o usuário está autenticado para criar novos administradores
        if (role === user_model_1.Role.ADMIN && (!req.user || req.user.role !== user_model_1.Role.ADMIN)) {
            throw new errorHandler_1.AppError('Você não tem permissão para criar usuários administradores', 403, undefined, 'PERMISSION_DENIED');
        }
        // Verifica se o usuário já existe
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });
        if (existingUser) {
            throw new errorHandler_1.AppError('Este email já está em uso por outro usuário', 409, 'email', 'DUPLICATE_EMAIL');
        }
        // Hash da senha
        const hashedPassword = await (0, password_1.hashPassword)(password);
        // Criar o usuário
        const newUser = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role
            }
        });
        // Gerar tokens de autenticação
        const authResponse = (0, jwt_1.generateAuthTokens)({
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            role: newUser.role
        });
        return res.status(201).json({
            message: 'Usuário registrado com sucesso',
            ...authResponse
        });
    }
    catch (error) {
        return (0, errorHandler_1.handleError)(error, res);
    }
};
exports.register = register;
/**
 * Autentica um usuário
 */
const login = async (req, res) => {
    try {
        // A validação já foi feita pelo middleware
        const loginData = req.body;
        const { email, password } = loginData;
        // Buscar o usuário
        const user = await prisma.user.findUnique({
            where: { email }
        });
        if (!user) {
            throw new errorHandler_1.AppError('Email ou senha incorretos', 401, 'email', 'INVALID_CREDENTIALS');
        }
        // Verificar a senha
        const isPasswordValid = await (0, password_1.comparePassword)(password, user.password);
        if (!isPasswordValid) {
            throw new errorHandler_1.AppError('Email ou senha incorretos', 401, 'password', 'INVALID_CREDENTIALS');
        }
        // Gerar tokens de autenticação
        const authResponse = (0, jwt_1.generateAuthTokens)({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        });
        return res.status(200).json({
            message: 'Login realizado com sucesso',
            userData: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            ...authResponse
        });
    }
    catch (error) {
        return (0, errorHandler_1.handleError)(error, res);
    }
};
exports.login = login;
/**
 * Atualiza o token de acesso usando o refresh token
 */
const refreshToken = async (req, res) => {
    try {
        // A validação já foi feita pelo middleware
        const { refreshToken } = req.body;
        // Verificar o refresh token
        const decoded = (0, jwt_1.verifyRefreshToken)(refreshToken);
        if (!decoded) {
            throw new errorHandler_1.AppError('O token de atualização é inválido ou expirou. Por favor, faça login novamente.', 401, 'refreshToken', 'INVALID_REFRESH_TOKEN');
        }
        // Buscar o usuário
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId }
        });
        if (!user) {
            throw new errorHandler_1.AppError('Não foi possível encontrar o usuário associado a este token.', 401, 'refreshToken', 'USER_NOT_FOUND');
        }
        // Gerar novos tokens de autenticação
        const authResponse = (0, jwt_1.generateAuthTokens)({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        });
        return res.status(200).json({
            message: 'Token atualizado com sucesso',
            ...authResponse
        });
    }
    catch (error) {
        return (0, errorHandler_1.handleError)(error, res);
    }
};
exports.refreshToken = refreshToken;
/**
 * Faz logout do usuário (invalida o token no cliente)
 */
const logout = async (_req, res) => {
    try {
        // Implementação básica - a invalidação real dos tokens deve ser feita no cliente
        return res.status(200).json({
            message: 'Logout realizado com sucesso',
            details: 'Para completar o logout, remova os tokens armazenados no cliente.'
        });
    }
    catch (error) {
        return (0, errorHandler_1.handleError)(error, res);
    }
};
exports.logout = logout;
