// Interfaces para o modelo de aluno
export interface Student {
  id: number;
  registrationDate: Date;
  fullName: string;
  ddd: string;
  phone: string;
  email?: string;
  birthDate?: Date;
  cpf: string;
  cnhNumber?: string;
  cnhType?: string;
  renach?: string;
  courseId: number;
  courseModalityId: number;
  value: number;
  paymentType: string;
  installments: number;
  paymentStatus: string;
  paymentDate?: Date;
  paymentForecastDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
}

// Interface para criação de aluno
export interface CreateStudentInput {
  fullName: string;
  ddd: string;
  phone: string;
  email?: string;
  birthDate?: Date;
  cpf: string;
  cnhNumber?: string;
  cnhType?: string;
  renach?: string;
  courseId: number;
  courseModalityId: number;
  value: number;
  paymentType: string;
  installments: number;
  paymentStatus: string;
  paymentDate?: Date;
  paymentForecastDate?: Date;
}

// Interface para atualização de aluno
export interface UpdateStudentInput {
  fullName?: string;
  ddd?: string;
  phone?: string;
  email?: string;
  birthDate?: Date;
  cpf?: string;
  cnhNumber?: string;
  cnhType?: string;
  renach?: string;
  courseId?: number;
  courseModalityId?: number;
  value?: number;
  paymentType?: string;
  installments?: number;
  paymentStatus?: string;
  paymentDate?: Date;
  paymentForecastDate?: Date;
}

// Interface para filtros de consulta de alunos
export interface StudentFilters {
  userId?: number;
  fullName?: string;
  cpf?: string;
  courseId?: number;
  paymentStatus?: string;
  startDate?: Date;
  endDate?: Date;
}

// Interface para resposta paginada de alunos
export interface PaginatedStudentsResponse {
  students: Student[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} 