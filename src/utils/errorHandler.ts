import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

// Interface para respostas de erro padronizadas
export interface ErrorResponse {
  error: string;
  message: string;
  field?: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Classe de erro customizada para tratamento de erros de negócio
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly field?: string;
  public readonly code?: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string, 
    statusCode = 400, 
    field?: string, 
    code?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.field = field;
    this.code = code;
    this.details = details;
    this.name = 'AppError';
  }
}

/**
 * Função para tratar erros do Prisma
 */
export const handlePrismaError = (error: Prisma.PrismaClientKnownRequestError): ErrorResponse => {
  // Erro de violação de chave única (ex: email já cadastrado)
  if (error.code === 'P2002') {
    const field = Array.isArray(error.meta?.target) 
      ? (error.meta?.target as string[])[0] 
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

/**
 * Função para tratar erros de validação do Zod
 */
export const handleZodError = (error: ZodError): ErrorResponse => {
  const formattedErrors: Record<string, { message: string; path?: string[] }> = {};
  
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

/**
 * Função principal para tratamento de erros
 */
export const handleError = (error: unknown, res: Response): Response => {
  console.error('Erro capturado:', error);
  
  // Erro de aplicação
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.name,
      message: error.message,
      field: error.field,
      code: error.code,
      details: error.details
    } as ErrorResponse);
  }
  
  // Erro do Prisma
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const errorResponse = handlePrismaError(error);
    return res.status(400).json(errorResponse);
  }
  
  // Erro do Zod
  if (error instanceof ZodError) {
    const errorResponse = handleZodError(error);
    return res.status(400).json(errorResponse);
  }
  
  // Erro de JWT
  if (error instanceof Error && error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Token inválido',
      message: 'O token fornecido é inválido ou foi adulterado'
    } as ErrorResponse);
  }
  
  // Erro de expiração de JWT
  if (error instanceof Error && error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expirado',
      message: 'O token expirou. Por favor, faça login novamente'
    } as ErrorResponse);
  }
  
  // Erro genérico
  return res.status(500).json({
    error: 'Erro interno do servidor',
    message: 'Ocorreu um erro inesperado. Por favor, tente novamente mais tarde.'
  } as ErrorResponse);
}; 