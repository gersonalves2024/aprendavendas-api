import jwt from 'jsonwebtoken';
import type { Role } from '../models/user.model';
import type { Secret, SignOptions } from 'jsonwebtoken';

// Tipos para payload do token
export interface TokenPayload {
  userId: number;
  email: string;
  role: Role;
}

// Tipos para resposta de autenticação
export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: {
    id: number;
    email: string;
    name: string;
    ddd?: string;
    phone?: string;
    role: Role;
  };
}

/**
 * Gera um token JWT
 */
export const generateToken = (payload: TokenPayload): string => {
  const secret = process.env.JWT_SECRET || 'fallback_secret';
  const expiresIn = process.env.JWT_EXPIRES_IN || '1h';
  
  return jwt.sign(payload, secret as Secret, { expiresIn } as SignOptions);
};

/**
 * Gera um refresh token
 */
export const generateRefreshToken = (payload: TokenPayload): string => {
  const secret = process.env.REFRESH_TOKEN_SECRET || 'refresh_fallback_secret';
  const expiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
  
  return jwt.sign(payload, secret as Secret, { expiresIn } as SignOptions);
};

/**
 * Verifica e decodifica um token JWT
 */
export const verifyToken = (token: string): TokenPayload | null => {
  try {
    const secret = process.env.JWT_SECRET || 'fallback_secret';
    const decoded = jwt.verify(token, secret as Secret) as TokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
};

/**
 * Verifica e decodifica um refresh token
 */
export const verifyRefreshToken = (token: string): TokenPayload | null => {
  try {
    const secret = process.env.REFRESH_TOKEN_SECRET || 'refresh_fallback_secret';
    const decoded = jwt.verify(token, secret as Secret) as TokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
};

/**
 * Gera tokens de autenticação e estrutura a resposta
 */
export const generateAuthTokens = (user: { 
  id: number; 
  email: string; 
  name: string; 
  ddd?: string;
  phone?: string;
  role: Role 
}): AuthResponse => {
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role
  };

  const token = generateToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return {
    token,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      ddd: user.ddd,
      phone: user.phone,
      role: user.role
    }
  };
}; 