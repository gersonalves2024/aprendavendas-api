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

// Interface para criação de aluno (versão com suporte a múltiplos cursos)
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
  // Dados para compatibilidade - primeiro curso
  courseId: number;
  courseModalityId: number;
  // Novos campos para múltiplos cursos
  courses?: {
    courseId: number;
    courseModalityId: number;
  }[];
  // Campo valor total (obrigatório)
  totalValue: number;
  // Mantidos para compatibilidade
  value: number;
  paymentType: string;
  installments: number;
  paymentStatus: string;
  paymentDate?: Date;
  paymentForecastDate?: Date;
  couponCode?: string;
  discountAmount?: number;
  affiliateCommission?: number;
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
  // Dados para compatibilidade com sistema antigo
  courseId?: number;
  courseModalityId?: number;
  value?: number;
  // Novos campos para múltiplos cursos
  courses?: {
    courseId: number;
    courseModalityId: number;
  }[];
  // Transações para atualização de status
  transactions?: {
    id: number;
    paymentStatus?: string;
    paymentDate?: Date;
    paymentForecastDate?: Date;
  }[];
  // Campo valor total (opcional na atualização)
  totalValue?: number;
  // Demais campos
  paymentType?: string;
  installments?: number;
  paymentStatus?: string;
  paymentDate?: Date;
  paymentForecastDate?: Date;
  couponCode?: string;
  discountAmount?: number;
  affiliateCommission?: number;
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