// Interfaces para o modelo de transação
export interface Transaction {
  id: number;
  studentId: number;
  totalValue: number;
  paymentType: string;
  installments: number;
  paymentStatus: string;
  paymentDate?: Date;
  paymentForecastDate?: Date;
  createdById: number;
  couponId?: number;
  discountAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Interface para curso na transação
export interface TransactionCourse {
  id: number;
  transactionId: number;
  courseId: number;
  courseModalityId: number;
}

// Interface para criação de transação
export interface CreateTransactionInput {
  studentId: number;
  totalValue: number;
  paymentType: string;
  installments: number;
  paymentStatus: string;
  paymentDate?: Date;
  paymentForecastDate?: Date;
  courses: {
    courseId: number;
    courseModalityId: number;
  }[];
  couponCode?: string;
  discountAmount?: number;
}

// Interface para atualização de transação
export interface UpdateTransactionInput {
  totalValue?: number;
  paymentType?: string;
  installments?: number;
  paymentStatus?: string;
  paymentDate?: Date;
  paymentForecastDate?: Date;
  courses?: {
    courseId: number;
    courseModalityId: number;
  }[];
  couponCode?: string;
  discountAmount?: number;
}

// Interface para filtros de consulta de transações
export interface TransactionFilters {
  studentId?: number;
  userId?: number;
  paymentStatus?: string;
  startDate?: Date;
  endDate?: Date;
  courseId?: number;
}

// Interface para transação com cursos incluídos
export interface TransactionWithCourses extends Transaction {
  courses: {
    id: number;
    courseId: number;
    courseModalityId: number;
    course: {
      id: number;
      name: string;
      code: string;
    };
    courseModality: {
      id: number;
      name: string;
      code: string;
    };
  }[];
}

// Interface para resposta paginada de transações
export interface PaginatedTransactionsResponse {
  transactions: TransactionWithCourses[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} 