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
    const { email, password, name, ddd, phone, role = Role.SELLER } = userData;
    
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
        ddd,
        phone,
        role
      }
    });
    
    // Gerar tokens de autenticação
    const authResponse = generateAuthTokens({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      ddd: newUser.ddd ?? undefined,
      phone: newUser.phone ?? undefined,
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
      ddd: user.ddd ?? undefined,
      phone: user.phone ?? undefined,
      role: user.role as Role
    });
    
    return res.status(200).json({
      message: 'Login realizado com sucesso',
      userData: {
        id: user.id,
        email: user.email,
        name: user.name,
        ddd: user.ddd,
        phone: user.phone,
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
      ddd: user.ddd ?? undefined,
      phone: user.phone ?? undefined,
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

/**
 * Lista usuários por perfil (role)
 */
export const listUsersByRole = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { role } = req.query;
    
    // Verificar se o usuário é administrador
    if (req.user?.role !== Role.ADMIN) {
      throw new AppError('Acesso negado. Apenas administradores podem listar usuários.', 403, undefined, 'PERMISSION_DENIED');
    }
    
    // Validar o role fornecido
    if (role && !Object.values(Role).includes(role as Role)) {
      throw new AppError('Tipo de perfil inválido.', 400, 'role', 'INVALID_ROLE');
    }
    
    // Definir as condições de busca
    const where: Prisma.UserWhereInput = {};
    
    if (role) {
      where.role = role as Role;
    }
    
    // Buscar usuários com as condições definidas
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        ddd: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    return res.status(200).json(users);
    
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Remove um usuário
 */
export const deleteUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    
    // Verificar se o usuário é administrador
    if (req.user?.role !== Role.ADMIN) {
      throw new AppError('Acesso negado. Apenas administradores podem excluir usuários.', 403, undefined, 'PERMISSION_DENIED');
    }
    
    // Converter o id para número
    const userId = Number.parseInt(id, 10);
    
    if (Number.isNaN(userId)) {
      throw new AppError('ID de usuário inválido.', 400, 'id', 'INVALID_ID');
    }
    
    // Verificar se o usuário existe
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      throw new AppError('Usuário não encontrado.', 404, 'id', 'USER_NOT_FOUND');
    }
    
    // Remover o usuário
    await prisma.user.delete({
      where: { id: userId }
    });
    
    return res.status(200).json({ 
      message: 'Usuário removido com sucesso.'
    });
    
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Obtém detalhes de um usuário específico
 */
export const getUserById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    
    // Verificar se o usuário é administrador
    if (req.user?.role !== Role.ADMIN) {
      throw new AppError('Acesso negado. Apenas administradores podem visualizar detalhes de usuários.', 403, undefined, 'PERMISSION_DENIED');
    }
    
    // Converter o id para número
    const userId = Number.parseInt(id, 10);
    
    if (Number.isNaN(userId)) {
      throw new AppError('ID de usuário inválido.', 400, 'id', 'INVALID_ID');
    }
    
    // Buscar o usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        ddd: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    if (!user) {
      throw new AppError('Usuário não encontrado.', 404, 'id', 'USER_NOT_FOUND');
    }
    
    return res.status(200).json(user);
    
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Atualiza um usuário
 */
export const updateUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { name, email, ddd, phone, password } = req.body;
    
    // Verificar se o usuário é administrador
    if (req.user?.role !== Role.ADMIN) {
      throw new AppError('Acesso negado. Apenas administradores podem atualizar usuários.', 403, undefined, 'PERMISSION_DENIED');
    }
    
    // Converter o id para número
    const userId = Number.parseInt(id, 10);
    
    if (Number.isNaN(userId)) {
      throw new AppError('ID de usuário inválido.', 400, 'id', 'INVALID_ID');
    }
    
    // Verificar se o usuário existe
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!existingUser) {
      throw new AppError('Usuário não encontrado.', 404, 'id', 'USER_NOT_FOUND');
    }
    
    // Verificar se o email já está em uso por outro usuário
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email }
      });
      
      if (emailExists) {
        throw new AppError('Este email já está em uso por outro usuário.', 409, 'email', 'DUPLICATE_EMAIL');
      }
    }
    
    // Preparar os dados para atualização
    const updateData: Prisma.UserUpdateInput = {};
    
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (ddd !== undefined) updateData.ddd = ddd;
    if (phone !== undefined) updateData.phone = phone;
    
    // Se foi fornecida uma nova senha, fazer o hash
    if (password) {
      updateData.password = await hashPassword(password);
    }
    
    // Atualizar o usuário
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        ddd: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    return res.status(200).json({
      message: 'Usuário atualizado com sucesso.',
      user: updatedUser
    });
    
  } catch (error) {
    return handleError(error, res);
  }
}; 