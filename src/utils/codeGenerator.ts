import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Gera um código único para entidades do sistema (cursos, modalidades)
 * @param prefix Prefixo do código (ex: CRS para curso, MOD para modalidade)
 * @returns String contendo o código gerado no formato PREFIX-XXXXXXXX
 */
export async function generateUniqueCode(prefix: string): Promise<string> {
  let isUnique = false;
  let code = '';
  
  // Tenta gerar um código único até encontrar um que não exista no banco de dados
  while (!isUnique) {
    // Gera um código aleatório com o prefixo e 8 caracteres alfanuméricos
    const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
    code = `${prefix}-${randomPart}`;
    
    // Verifica se o código já existe para curso ou modalidade
    const existingCourse = await prisma.course.findUnique({
      where: { code }
    });
    
    const existingModality = await prisma.courseModality.findUnique({
      where: { code }
    });
    
    // Se não existir nem em curso nem em modalidade, é um código único
    if (!existingCourse && !existingModality) {
      isUnique = true;
    }
  }
  
  return code;
} 