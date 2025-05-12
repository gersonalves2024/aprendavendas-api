import type { Student, User } from '@prisma/client';
import type { ReportFilters } from './schemas/report.schema';

/**
 * Interface para resultado de relatório agrupado
 */
export interface GroupedReportResult {
  groupKey: string;
  groupLabel: string;
  count: number;
  totalValue: number;
  avgValue: number;
  items?: ReportStudent[];
}

/**
 * Interface para resultados de relatório
 */
export interface ReportResult {
  students: ReportStudent[];
  grouped?: GroupedReportResult[];
  totals: ReportTotals;
  filters: ReportFilters;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Interface para aluno no relatório
 */
export interface ReportStudent extends Omit<Student, 'createdBy' | 'paymentDate' | 'paymentForecastDate'> {
  paymentDate: string | null;
  paymentForecastDate: string | null;
  createdBy: {
    id: number;
    name: string;
    email: string;
  };
  age?: number; // Calculado a partir da data de nascimento
}

/**
 * Interface para totais do relatório
 */
export interface ReportTotals {
  count: number;
  totalValue: number;
  avgValue: number;
  paymentStatusCounts: Record<string, number>;
  courseModalityIdCounts: Record<string, number>;
}

/**
 * Interface para estatísticas por período
 */
export interface PeriodStatistics {
  period: string;
  count: number;
  totalValue: number;
  avgValue: number;
}

/**
 * Interface para estatísticas por vendedor
 */
export interface SellerStatistics {
  seller: {
    id: number;
    name: string;
    email: string;
  };
  count: number;
  totalValue: number;
  avgValue: number;
  paymentStatusCounts: Record<string, number>;
}

/**
 * Interface para resposta de estatísticas
 */
export interface StatisticsResult {
  overall: {
    totalStudents: number;
    totalValue: number;
    avgValue: number;
    paymentStatusCounts: Record<string, number>;
    courseModalityIdCounts: Record<string, number>;
  };
  byPeriod: PeriodStatistics[];
  bySeller?: SellerStatistics[];
}

/**
 * Interface para opções de consulta
 */
export interface ReportQueryOptions {
  filters: ReportFilters;
  includeGrouped?: boolean;
  calculateStatistics?: boolean;
}

/**
 * Interface para cabeçalho de coluna na exportação
 */
export interface ColumnDefinition {
  field: string;
  header: string;
  width?: number;
  format?: (value: unknown) => string;
} 