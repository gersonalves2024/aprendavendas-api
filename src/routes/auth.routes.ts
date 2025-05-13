import { Router } from 'express';
import { 
  register, 
  login, 
  refreshToken, 
  logout,
  listUsersByRole,
  deleteUser,
  getUserById,
  updateUser
} from '../controllers/auth.controller';
import { 
  authenticate, 
  requireAdmin,
  requireProfile 
} from '../middlewares/auth.middleware';
import { 
  validate 
} from '../middlewares/validation.middleware';
import { 
  registerSchema, 
  loginSchema, 
  refreshTokenSchema 
} from '../models/schemas/auth.schema';
import { Role } from '../models/user.model';

const router = Router();

// Rota para registro (apenas administradores podem cadastrar vendedores)
router.post('/register', authenticate, requireAdmin, validate(registerSchema), register);

// Rota para registro de afiliado (pública - qualquer pessoa pode se registrar como afiliado)
router.post('/register/affiliate', validate(registerSchema), async (req, res, next) => {
  req.body.role = Role.AFFILIATE;
  next();
}, register);

// Rota para login
router.post('/login', validate(loginSchema), login);

// Rota para renovar token
router.post('/refresh-token', validate(refreshTokenSchema), refreshToken);

// Rota para logout
router.post('/logout', authenticate, logout);

// Rota para listar usuários por perfil (apenas admin)
router.get('/users', authenticate, requireAdmin, listUsersByRole);

// Rota para obter detalhes de um usuário específico (apenas admin)
router.get('/users/:id', authenticate, requireAdmin, getUserById);

// Rota para atualizar um usuário (apenas admin)
router.put('/users/:id', authenticate, requireAdmin, updateUser);

// Rota para excluir usuário (apenas admin)
router.delete('/users/:id', authenticate, requireAdmin, deleteUser);

export default router; 