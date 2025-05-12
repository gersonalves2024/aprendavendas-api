"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = require("express-rate-limit");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
// Rotas (serão implementadas posteriormente)
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const student_routes_1 = __importDefault(require("./routes/student.routes"));
const report_routes_1 = __importDefault(require("./routes/report.routes"));
const course_routes_1 = __importDefault(require("./routes/course.routes"));
// Inicialização
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
const prisma = new client_1.PrismaClient();
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
                    role: client_1.Role.ADMIN,
                },
            });
            console.log('Usuário administrador criado com sucesso!');
            console.log('Credenciais:');
            console.log(`Email: ${adminEmail}`);
            console.log(`Senha: ${adminPassword}`);
            console.log('IMPORTANTE: Altere a senha após o primeiro login!');
        }
        else {
            console.log('Usuário administrador já existe no sistema.');
        }
    }
    catch (error) {
        console.error('Erro ao verificar/criar usuário administrador:', error);
    }
}
// Middlewares globais
app.use(express_1.default.json());
app.use((0, cors_1.default)());
app.use((0, helmet_1.default)());
// Rate limiting para proteção contra ataques de força bruta
const limiter = (0, express_rate_limit_1.rateLimit)({
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
app.use('/api/auth', auth_routes_1.default);
app.use('/api/students', student_routes_1.default);
app.use('/api/reports', report_routes_1.default);
app.use('/api', course_routes_1.default);
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
exports.default = app;
