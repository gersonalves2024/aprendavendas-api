import { Router } from 'express';
import { 
  register, 
  login, 
  refreshToken, 
  logout 
} from '../controllers/auth.controller';
import { 
  authenticate, 
  requireAdmin 
} from '../middlewares/auth.middleware';
import { 
  validate 
} from '../middlewares/validation.middleware';
import { 
  registerSchema, 
  loginSchema, 
  refreshTokenSchema 
} from '../models/schemas/auth.schema';

const router = Router();

// Rota para registro (apenas administradores podem cadastrar novos usuários)
router.post('/register', authenticate, requireAdmin, validate(registerSchema), register);

// Rota para login
router.post('/login', validate(loginSchema), login);

// Rota para renovar token
router.post('/refresh-token', validate(refreshTokenSchema), refreshToken);

// Rota para logout
router.post('/logout', authenticate, logout);

export default router; 