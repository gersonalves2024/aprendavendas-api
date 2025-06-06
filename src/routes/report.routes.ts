import { Router } from 'express';
import { 
  generateReport, 
  generateStatistics, 
  exportReport 
} from '../controllers/report.controller';
import { 
  authenticate, 
  requireAdmin 
} from '../middlewares/auth.middleware';
import { 
  validate 
} from '../middlewares/validation.middleware';
import { 
  reportFiltersSchema,
  reportExportSchema
} from '../models/schemas/report.schema';

const router = Router();

// Todas as rotas de relatórios requerem autenticação
router.use(authenticate);

// Rota para geração de relatórios com filtros avançados
router.get('/', validate(reportFiltersSchema, 'query'), generateReport);

// Rota para geração de estatísticas
router.get('/statistics', validate(reportFiltersSchema, 'query'), generateStatistics);

// Rota para exportação de relatórios
router.get('/export', validate(reportExportSchema, 'query'), exportReport);

export default router; 