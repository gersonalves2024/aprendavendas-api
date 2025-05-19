import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from 'express';

// Rotas (serão implementadas posteriormente)
import authRoutes from './routes/auth.routes';
import studentRoutes from './routes/student.routes';
import reportRoutes from './routes/report.routes';
import courseRoutes from './routes/course.routes';
import couponRoutes from './routes/coupon.routes';
import paymentRoutes from './routes/payment.routes';
import transactionRoutes from './routes/transaction.routes';

// Jobs agendados
import { startPaymentStatusChecker } from './jobs/payment-status-checker';

// Inicialização
const app = express();
const PORT = process.env.PORT || 3001;
const prisma = new PrismaClient();

// Verificação e criação do usuário admin
async function ensureAdminExists() {
  try {
    const adminEmail = 'admin@aprendaalcancar.com.br';
    const adminPassword = '@VianaMata2023!';
    const saltRounds = 10;

    const adminExists = await prisma.user.findUnique({
      where: {
        email: adminEmail,
      },
    });

    if (!adminExists) {
      console.log('Usuário administrador não encontrado. Criando usuário padrão...');
      const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);
      
      await prisma.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          name: 'Administrador',
          role: Role.ADMIN,
        },
      });

      console.log('Usuário administrador criado com sucesso!');
      console.log('Credenciais:');
      console.log(`Email: ${adminEmail}`);
      console.log(`Senha: ${adminPassword}`);
      console.log('IMPORTANTE: Altere a senha após o primeiro login!');
    } else {
      console.log('Usuário administrador já existe no sistema.');
    }
  } catch (error) {
    console.error('Erro ao verificar/criar usuário administrador:', error);
  }
}

// Middlewares globais
app.use(express.json());
app.use(cors());
app.use(helmet());

// Configuração de rate limiting aprimorada
// Limiter padrão para a maioria das rotas (mais restritivo)
const defaultLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite de 100 requisições por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Muitas requisições deste IP, tente novamente mais tarde'
});

// Limiter para rotas de estudantes e cursos (menos restritivo)
const studentsAndCoursesLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 200, // limite bem maior para APIs usadas frequentemente
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Muitas requisições de listagem, tente novamente em um minuto'
});

// Limiter para autenticação (previne ataques de força bruta)
const authLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutos
  max: 20, // limite mais restritivo para logins
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Muitas tentativas de login, tente novamente mais tarde'
});

// Middleware de cache em memória simples
const memoryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos em milissegundos

// Limpar cache expirado periodicamente
setInterval(() => {
  const now = Date.now();
  for (const [key, cache] of memoryCache.entries()) {
    if (now - cache.timestamp > CACHE_TTL) {
      memoryCache.delete(key);
    }
  }
}, 60 * 1000); // Limpar a cada minuto

// Middleware para cachear respostas de rotas específicas
const cacheMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Só aplicar cache para requisições GET
  if (req.method !== 'GET') {
    return next();
  }
  
  // Definir quais rotas devem ser cacheadas
  const cachableRoutes = [
    '/api/course-modalities',
    '/api/courses'
  ];
  
  // Verificar se esta rota deve ser cacheada
  const shouldCache = cachableRoutes.some(route => req.url.startsWith(route));
  if (!shouldCache) {
    return next();
  }
  
  // Criar uma chave única para o cache baseada na URL e query params
  const cacheKey = `${req.url}`;
  
  // Verificar se temos dados em cache para esta rota
  const cachedData = memoryCache.get(cacheKey);
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
    console.log(`[CACHE] Servindo resposta cacheada para ${req.url}`);
    return res.json(cachedData.data);
  }
  
  // Substituir o método json do response para cachear a resposta
  const originalJson = res.json;
  res.json = function(body) {
    // Armazenar resposta no cache
    memoryCache.set(cacheKey, {
      data: body,
      timestamp: Date.now()
    });
    console.log(`[CACHE] Armazenando resposta para ${req.url}`);
    
    // Chamar o método json original
    return originalJson.call(this, body);
  };
  
  next();
};

// Rota de verificação de saúde da API
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

// Aplicar middleware de cache
app.use(cacheMiddleware);

// Configuração das rotas com limiters específicos
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/students', studentsAndCoursesLimiter, studentRoutes);
app.use('/api/reports', defaultLimiter, reportRoutes);
app.use('/api/coupons', defaultLimiter, couponRoutes);
app.use('/api/payments', defaultLimiter, paymentRoutes);
app.use('/api/transactions', defaultLimiter, transactionRoutes);
app.use('/api', studentsAndCoursesLimiter, courseRoutes); // Incluindo rotas de cursos no limiter menos restritivo

// Iniciar servidor
const startServer = async () => {
  // Garantir que o admin existe antes de iniciar o servidor
  await ensureAdminExists();
  
  const server = app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    
    // Iniciar jobs agendados
    startPaymentStatusChecker();
  });

  // Tratamento de erros do servidor
  process.on('SIGTERM', async () => {
    console.log('SIGTERM recebido, fechando servidor graciosamente');
    await prisma.$disconnect();
    server.close(() => {
      console.log('Servidor fechado');
      process.exit(0);
    });
  });
};

startServer().catch(error => {
  console.error('Erro ao iniciar o servidor:', error);
  process.exit(1);
});

export default app; 