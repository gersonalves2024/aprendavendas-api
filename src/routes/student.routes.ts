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
  requireAdmin,
  requireProfile 
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
import { Role } from '../models/user.model';

const router = Router();

// Todas as rotas de alunos requerem autenticação
router.use(authenticate);

// Rotas para gerenciamento de alunos
// Apenas vendedores podem criar alunos
router.post('/', requireProfile([Role.SELLER]), validate(createStudentSchema), createStudent);

// Vendedores e afiliados podem listar alunos (com filtragem por usuário no controller)
router.get('/', validate(paginationSchema, 'query'), validate(filtersSchema, 'query'), getStudents);

// Vendedores e afiliados podem ver detalhes de alunos (com verificação de propriedade no controller)
router.get('/:id', getStudentById);

// Apenas vendedores podem atualizar alunos
router.put('/:id', requireProfile([Role.SELLER]), validate(updateStudentSchema), updateStudent);

// Apenas administradores podem excluir alunos
router.delete('/:id', requireAdmin, deleteStudent);

export default router; 