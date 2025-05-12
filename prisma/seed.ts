import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed do banco de dados...');

  const adminEmail = 'admin@aprendaalcancar.com.br';
  const adminPassword = '@VianaMata2023!';
  const saltRounds = 10;

  // Verificar se já existe um admin
  const adminExists = await prisma.user.findUnique({
    where: {
      email: adminEmail,
    },
  });

  if (!adminExists) {
    // Cria o hash da senha
    const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);

    // Criar o usuário admin
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: 'Administrador',
        role: Role.ADMIN,
      },
    });

    console.log(`Usuário administrador criado com ID: ${admin.id}`);
    console.log('Credenciais:');
    console.log(`Email: ${adminEmail}`);
    console.log(`Senha: ${adminPassword}`);
    console.log('IMPORTANTE: Altere a senha do administrador após o primeiro login!');
  } else {
    console.log('Usuário administrador já existe, pulando criação.');
  }

  // Criar tipos de curso
  const courseTypes = [
    { code: 'FORM', name: 'Formação', description: 'Cursos para formação inicial' },
    { code: 'ATUAL', name: 'Atualização', description: 'Cursos para atualização profissional' },
    { code: 'ESPEC', name: 'Especialização', description: 'Cursos para especialização em áreas específicas' }
  ];

  for (const typeData of courseTypes) {
    const existingType = await prisma.courseType.findUnique({
      where: { code: typeData.code }
    });

    if (!existingType) {
      await prisma.courseType.create({ data: typeData });
      console.log(`Tipo de curso criado: ${typeData.name}`);
    } else {
      console.log(`Tipo de curso ${typeData.name} já existe, pulando criação.`);
    }
  }

  // Buscar os tipos de curso para usar na criação dos cursos
  const formacaoType = await prisma.courseType.findUnique({ where: { code: 'FORM' } });
  const atualizacaoType = await prisma.courseType.findUnique({ where: { code: 'ATUAL' } });
  const especializacaoType = await prisma.courseType.findUnique({ where: { code: 'ESPEC' } });

  if (formacaoType && atualizacaoType && especializacaoType) {
    // Criar cursos
    const courses = [
      { 
        code: 'COLETPAS', 
        name: 'Coletivos de Passageiros', 
        description: 'Curso para condutores de veículos de transporte coletivo de passageiros',
        courseTypeId: formacaoType.id
      },
      { 
        code: 'TRANESC', 
        name: 'Transporte Escolar', 
        description: 'Curso para condutores de veículos de transporte escolar',
        courseTypeId: formacaoType.id
      },
      { 
        code: 'TRANCAR', 
        name: 'Transporte de Cargas', 
        description: 'Curso para condutores de veículos de transporte de cargas',
        courseTypeId: formacaoType.id
      },
      { 
        code: 'TRANEME', 
        name: 'Transporte de Emergência', 
        description: 'Curso para condutores de veículos de transporte de emergência',
        courseTypeId: especializacaoType.id
      },
      { 
        code: 'MOTOTAX', 
        name: 'Mototaxista', 
        description: 'Curso para mototaxistas',
        courseTypeId: formacaoType.id
      },
      { 
        code: 'MOTOFRET', 
        name: 'Motofretista', 
        description: 'Curso para motofretistas',
        courseTypeId: formacaoType.id
      }
    ];

    for (const courseData of courses) {
      const existingCourse = await prisma.course.findUnique({
        where: { code: courseData.code }
      });

      if (!existingCourse) {
        await prisma.course.create({ data: courseData });
        console.log(`Curso criado: ${courseData.name}`);
      } else {
        console.log(`Curso ${courseData.name} já existe, pulando criação.`);
      }
    }
  }

  console.log('Seed completado com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro durante o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 