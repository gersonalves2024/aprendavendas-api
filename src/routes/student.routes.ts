import { Router } from 'express';
import { 
  createStudent, 
  getStudents, 
  getStudentById, 
  updateStudent, 
  deleteStudent 
} from '../controllers/student.controller';
import { 
  authenticate, 
  requireAdmin 
} from '../middlewares/auth.middleware';
import { 
  validate 
} from '../middlewares/validation.middleware';
import { 
  createStudentSchema, 
  updateStudentSchema, 
  paginationSchema, 
  filtersSchema 
} from '../models/schemas/student.schema';

const router = Router();

// Todas as rotas de alunos requerem autenticação
router.use(authenticate);

// Rotas para gerenciamento de alunos
router.post('/', validate(createStudentSchema), createStudent);
router.get('/', validate(paginationSchema, 'query'), validate(filtersSchema, 'query'), getStudents);
router.get('/:id', getStudentById);
router.put('/:id', validate(updateStudentSchema), updateStudent);
router.delete('/:id', requireAdmin, deleteStudent);

export default router; 