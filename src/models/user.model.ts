// Enum para tipo de usuário
export enum Role {
  ADMIN = 'ADMIN',
  SELLER = 'SELLER'
}

// Interface para usuário
export interface User {
  id: number;
  email: string;
  password: string;
  name: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

// Interface para criação de usuário
export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role?: Role;
}

// Interface para login
export interface LoginInput {
  email: string;
  password: string;
}

// Interface para resposta de usuário (sem senha)
export interface UserResponse {
  id: number;
  email: string;
  name: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
} 