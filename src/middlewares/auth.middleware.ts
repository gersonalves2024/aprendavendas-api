import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { Role } from '../models/user.model';
import { handleError, AppError } from '../utils/errorHandler';

// Estende o tipo Request para incluir o usuário autenticado
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        email: string;
        role: Role;
      };
    }
  }
}

/**
 * Middleware para verificar se o usuário está autenticado
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): Response | undefined => {
  try {
    // Extrai o token do header de autorização
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Token não fornecido ou formato inválido', 401, 'authorization', 'AUTH_HEADER_MISSING');
    }
    
    // Pega apenas o token (remove o "Bearer ")
    const token = authHeader.split(' ')[1];
    
    // Verifica e decodifica o token
    const decoded = verifyToken(token);
    
    if (!decoded) {
      throw new AppError('Token inválido ou expirado', 401, 'token', 'INVALID_TOKEN');
    }
    
    // Adiciona o usuário ao objeto de requisição para uso em outros middlewares ou controladores
    req.user = decoded;
    
    // Continua para o próximo middleware ou controlador
    next();
    return undefined;
    
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Middleware para verificar se o usuário tem permissão de administrador
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): Response | undefined => {
  try {
    // Primeiro verifica se o usuário está autenticado
    if (!req.user) {
      throw new AppError('Usuário não autenticado. Por favor, faça login para continuar.', 401, undefined, 'AUTH_REQUIRED');
    }
    
    // Verifica se o usuário é um administrador
    if (req.user.role !== Role.ADMIN) {
      throw new AppError('Você não tem permissão de administrador para acessar este recurso.', 403, undefined, 'ADMIN_REQUIRED');
    }
    
    // Continua para o próximo middleware ou controlador
    next();
    return undefined;
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Middleware para verificar se o usuário tem permissões de acesso a um recurso específico
 * (usado para permitir que vendedores acessem apenas seus próprios recursos)
 */
export const requireOwnershipOrAdmin = (resourceIdParam: string) => {
  return (req: Request, res: Response, next: NextFunction): Response | undefined => {
    try {
      // Primeiro verifica se o usuário está autenticado
      if (!req.user) {
        throw new AppError('Usuário não autenticado. Por favor, faça login para continuar.', 401, undefined, 'AUTH_REQUIRED');
      }
      
      // Administradores têm acesso a todos os recursos
      if (req.user.role === Role.ADMIN) {
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
      throw new AppError('Você não tem permissão para acessar este recurso específico.', 403, undefined, 'PERMISSION_DENIED');
    } catch (error) {
      return handleError(error, res);
    }
  };
}; 