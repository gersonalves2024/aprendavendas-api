// Enum para tipo de usuário
export enum Role {
  ADMIN = 'ADMIN',
  SELLER = 'SELLER',
  AFFILIATE = 'AFFILIATE'
}

// Interface para usuário
export interface User {
  id: number;
  email: string;
  password: string;
  name: string;
  ddd?: string; // Código de área (opcional)
  phone?: string; // Número do telefone (opcional)
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

// Interface para criação de usuário
export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  ddd?: string; // Código de área (opcional)
  phone?: string; // Número do telefone (opcional)
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
  ddd?: string; // Código de área (opcional)
  phone?: string; // Número do telefone (opcional)
  role: Role;
  createdAt: Date;
  updatedAt: Date;
} 