import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Rotas (serão implementadas posteriormente)
import authRoutes from './routes/auth.routes';
import studentRoutes from './routes/student.routes';
import reportRoutes from './routes/report.routes';
import courseRoutes from './routes/course.routes';
import couponRoutes from './routes/coupon.routes';

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

// Rate limiting para proteção contra ataques de força bruta
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite de 100 requisições por IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Rota de verificação de saúde da API
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

// Configuração das rotas
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api', courseRoutes);

// Iniciar servidor
const startServer = async () => {
  // Garantir que o admin existe antes de iniciar o servidor
  await ensureAdminExists();
  
  const server = app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
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