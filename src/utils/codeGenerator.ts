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

export const generateCourseCode = (name: string): string => {
  // Pegando até 3 caracteres do nome
  const prefix = name.substring(0, 3).toUpperCase();
  // Gerando 5 caracteres aleatórios (letras maiúsculas e números)
  const randomChars = Array.from({ length: 5 }, () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return chars.charAt(Math.floor(Math.random() * chars.length));
  }).join('');

  return `CRS-${prefix}${randomChars}`;
};

export const generateModalityCode = (name: string): string => {
  // Pegando até 4 caracteres do nome
  const prefix = name.substring(0, 4).toUpperCase();
  // Gerando 4 caracteres aleatórios (letras maiúsculas e números)
  const randomChars = Array.from({ length: 4 }, () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return chars.charAt(Math.floor(Math.random() * chars.length));
  }).join('');

  return `MOD-${prefix}${randomChars}`;
};

export const generateCouponCode = (affiliateName: string): string => {
  // Pegando até 4 caracteres do nome do afiliado (removendo espaços)
  const nameWithoutSpaces = affiliateName.replace(/\s+/g, '');
  const prefix = nameWithoutSpaces.substring(0, 4).toUpperCase();
  
  // Gerando 4 caracteres aleatórios (apenas letras maiúsculas)
  const randomChars = Array.from({ length: 4 }, () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return chars.charAt(Math.floor(Math.random() * chars.length));
  }).join('');

  return `${prefix}${randomChars}`;
}; 