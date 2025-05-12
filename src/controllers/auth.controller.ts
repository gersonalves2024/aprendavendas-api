import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { hashPassword, comparePassword } from '../utils/password';
import { generateAuthTokens, verifyRefreshToken } from '../utils/jwt';
import type { CreateUserInput, LoginInput } from '../models/user.model';
import { Role } from '../models/user.model';
import { handleError, AppError } from '../utils/errorHandler';

const prisma = new PrismaClient();

/**
 * Registra um novo usuário
 */
export const register = async (req: Request, res: Response): Promise<Response> => {
  try {
    // A validação já foi feita pelo middleware
    const userData = req.body as CreateUserInput;
    const { email, password, name, role = Role.SELLER } = userData;
    
    // Verifica se o usuário está autenticado para criar novos administradores
    if (role === Role.ADMIN && (!req.user || req.user.role !== Role.ADMIN)) {
      throw new AppError('Você não tem permissão para criar usuários administradores', 403, undefined, 'PERMISSION_DENIED');
    }
    
    // Verifica se o usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      throw new AppError('Este email já está em uso por outro usuário', 409, 'email', 'DUPLICATE_EMAIL');
    }
    
    // Hash da senha
    const hashedPassword = await hashPassword(password);
    
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
    const authResponse = generateAuthTokens({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role as Role
    });
    
    return res.status(201).json({
      message: 'Usuário registrado com sucesso',
      ...authResponse
    });
    
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Autentica um usuário
 */
export const login = async (req: Request, res: Response): Promise<Response> => {
  try {
    // A validação já foi feita pelo middleware
    const loginData = req.body as LoginInput;
    const { email, password } = loginData;
    
    // Buscar o usuário
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) {
      throw new AppError('Email ou senha incorretos', 401, 'email', 'INVALID_CREDENTIALS');
    }
    
    // Verificar a senha
    const isPasswordValid = await comparePassword(password, user.password);
    
    if (!isPasswordValid) {
      throw new AppError('Email ou senha incorretos', 401, 'password', 'INVALID_CREDENTIALS');
    }
    
    // Gerar tokens de autenticação
    const authResponse = generateAuthTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role
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
    
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Atualiza o token de acesso usando o refresh token
 */
export const refreshToken = async (req: Request, res: Response): Promise<Response> => {
  try {
    // A validação já foi feita pelo middleware
    const { refreshToken } = req.body as { refreshToken: string };
    
    // Verificar o refresh token
    const decoded = verifyRefreshToken(refreshToken);
    
    if (!decoded) {
      throw new AppError('O token de atualização é inválido ou expirou. Por favor, faça login novamente.', 401, 'refreshToken', 'INVALID_REFRESH_TOKEN');
    }
    
    // Buscar o usuário
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });
    
    if (!user) {
      throw new AppError('Não foi possível encontrar o usuário associado a este token.', 401, 'refreshToken', 'USER_NOT_FOUND');
    }
    
    // Gerar novos tokens de autenticação
    const authResponse = generateAuthTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role
    });
    
    return res.status(200).json({
      message: 'Token atualizado com sucesso',
      ...authResponse
    });
    
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Faz logout do usuário (invalida o token no cliente)
 */
export const logout = async (_req: Request, res: Response): Promise<Response> => {
  try {
    // Implementação básica - a invalidação real dos tokens deve ser feita no cliente
    return res.status(200).json({ 
      message: 'Logout realizado com sucesso',
      details: 'Para completar o logout, remova os tokens armazenados no cliente.'
    });
  } catch (error) {
    return handleError(error, res);
  }
}; 