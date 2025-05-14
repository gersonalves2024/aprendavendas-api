import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { validateRequestBody } from '../utils/validation';
import { z } from 'zod';
import { generateUniqueCode } from '../utils/codeGenerator';

const prisma = new PrismaClient();

/**
 * Validadores usando Zod para garantir a integridade dos dados
 */
const courseModalitySchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  description: z.string().optional(),
});

// Modificamos o schema para aceitar múltiplas modalidades
const courseSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  description: z.string().optional(),
  modalityIds: z.array(z.number().int().positive('IDs das modalidades devem ser números positivos')),
});

/**
 * Obter todas as modalidades de curso
 */
export const getAllCourseModalities = async (req: Request, res: Response) => {
  try {
    const courseModalities = await prisma.courseModality.findMany({
      orderBy: { name: 'asc' }
    });
    return res.status(200).json(courseModalities);
  } catch (error) {
    console.error('Erro ao buscar modalidades de curso:', error);
    return res.status(500).json({ error: 'Erro ao buscar modalidades de curso' });
  }
};

/**
 * Obter uma modalidade de curso pelo ID
 */
export const getCourseModalityById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const modalityId = Number.parseInt(id, 10);

  if (Number.isNaN(modalityId)) {
    return res.status(400).json({ error: 'ID da modalidade de curso inválido' });
  }

  try {
    const courseModality = await prisma.courseModality.findUnique({
      where: { id: modalityId },
      include: {
        courseToModality: {
          include: {
            course: true
          }
        }
      }
    });

    if (!courseModality) {
      return res.status(404).json({ error: 'Modalidade de curso não encontrada' });
    }

    // Transformar os dados para uma estrutura mais amigável para o frontend
    // Em vez de deletar a propriedade, extraímos o que queremos e construímos um novo objeto
    const { courseToModality, ...modalityData } = courseModality;
    const formattedModality = {
      ...modalityData,
      courses: courseToModality.map(ctm => ctm.course)
    };

    return res.status(200).json(formattedModality);
  } catch (error) {
    console.error('Erro ao buscar modalidade de curso:', error);
    return res.status(500).json({ error: 'Erro ao buscar modalidade de curso' });
  }
};

/**
 * Criar uma nova modalidade de curso
 */
export const createCourseModality = async (req: Request, res: Response) => {
  const validationResult = validateRequestBody(req.body, courseModalitySchema);
  if (!validationResult.success) {
    return res.status(400).json({ error: validationResult.error });
  }

  try {
    // Gerar código único para a modalidade
    const code = await generateUniqueCode("MOD");
    
    const courseModality = await prisma.courseModality.create({
      data: {
        ...req.body,
        code
      }
    });

    return res.status(201).json(courseModality);
  } catch (error) {
    console.error('Erro ao criar modalidade de curso:', error);
    return res.status(500).json({ error: 'Erro ao criar modalidade de curso' });
  }
};

/**
 * Atualizar uma modalidade de curso existente
 */
export const updateCourseModality = async (req: Request, res: Response) => {
  const { id } = req.params;
  const modalityId = Number.parseInt(id, 10);

  if (Number.isNaN(modalityId)) {
    return res.status(400).json({ error: 'ID da modalidade de curso inválido' });
  }

  const validationResult = validateRequestBody(req.body, courseModalitySchema);
  if (!validationResult.success) {
    return res.status(400).json({ error: validationResult.error });
  }

  try {
    // Verificar se a modalidade de curso existe
    const existingCourseModality = await prisma.courseModality.findUnique({
      where: { id: modalityId }
    });

    if (!existingCourseModality) {
      return res.status(404).json({ error: 'Modalidade de curso não encontrada' });
    }

    const courseModality = await prisma.courseModality.update({
      where: { id: modalityId },
      data: req.body
    });

    return res.status(200).json(courseModality);
  } catch (error) {
    console.error('Erro ao atualizar modalidade de curso:', error);
    return res.status(500).json({ error: 'Erro ao atualizar modalidade de curso' });
  }
};

/**
 * Excluir uma modalidade de curso
 */
export const deleteCourseModality = async (req: Request, res: Response) => {
  const { id } = req.params;
  const modalityId = Number.parseInt(id, 10);

  if (Number.isNaN(modalityId)) {
    return res.status(400).json({ error: 'ID da modalidade de curso inválido' });
  }

  try {
    // Verificar se a modalidade de curso existe
    const existingCourseModality = await prisma.courseModality.findUnique({
      where: { id: modalityId }
    });

    if (!existingCourseModality) {
      return res.status(404).json({ error: 'Modalidade de curso não encontrada' });
    }

    // Verificar se há cursos usando esta modalidade
    const coursesUsingModality = await prisma.courseToModality.count({
      where: { courseModalityId: modalityId }
    });

    if (coursesUsingModality > 0) {
      return res.status(400).json({ 
        error: 'Não é possível excluir esta modalidade pois existem cursos associados a ela' 
      });
    }

    // Verificar se há alunos usando esta modalidade
    const studentsUsingModality = await prisma.student.count({
      where: { courseModalityId: modalityId }
    });

    if (studentsUsingModality > 0) {
      return res.status(400).json({ 
        error: 'Não é possível excluir esta modalidade pois existem alunos associados a ela' 
      });
    }

    await prisma.courseModality.delete({
      where: { id: modalityId }
    });

    return res.status(200).json({ message: 'Modalidade de curso excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir modalidade de curso:', error);
    return res.status(500).json({ error: 'Erro ao excluir modalidade de curso' });
  }
};

/**
 * Obter todos os cursos
 */
export const getAllCourses = async (req: Request, res: Response) => {
  try {
    const { courseModalityId } = req.query;
    const where: Record<string, any> = {};
    
    if (courseModalityId) {
      const modalityId = Number.parseInt(courseModalityId as string, 10);
      if (!Number.isNaN(modalityId)) {
        where.courseToModality = {
          some: {
            courseModalityId: modalityId
          }
        };
      }
    }

    const courses = await prisma.course.findMany({
      where,
      include: { 
        courseToModality: {
          include: {
            courseModality: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Transformar os dados para uma estrutura mais amigável para o frontend
    const formattedCourses = courses.map(course => {
      const { courseToModality, ...courseData } = course;
      return {
        ...courseData,
        modalities: courseToModality.map(ctm => ctm.courseModality)
      };
    });

    return res.status(200).json(formattedCourses);
  } catch (error) {
    console.error('Erro ao buscar cursos:', error);
    return res.status(500).json({ error: 'Erro ao buscar cursos' });
  }
};

/**
 * Obter um curso pelo ID
 */
export const getCourseById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const courseId = Number.parseInt(id, 10);

  if (Number.isNaN(courseId)) {
    return res.status(400).json({ error: 'ID do curso inválido' });
  }

  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { 
        courseToModality: {
          include: {
            courseModality: true
          }
        }
      }
    });

    if (!course) {
      return res.status(404).json({ error: 'Curso não encontrado' });
    }

    // Transformar os dados para uma estrutura mais amigável para o frontend
    const { courseToModality, ...courseData } = course;
    const formattedCourse = {
      ...courseData,
      modalities: courseToModality.map(ctm => ctm.courseModality)
    };

    return res.status(200).json(formattedCourse);
  } catch (error) {
    console.error('Erro ao buscar curso:', error);
    return res.status(500).json({ error: 'Erro ao buscar curso' });
  }
};

/**
 * Criar um novo curso
 */
export const createCourse = async (req: Request, res: Response) => {
  const validationResult = validateRequestBody(req.body, courseSchema);
  if (!validationResult.success) {
    return res.status(400).json({ error: validationResult.error });
  }

  const { name, description, modalityIds } = req.body;

  try {
    // Gerar código único para o curso
    const code = await generateUniqueCode("CRS");
    
    // Verificar se todas as modalidades de curso existem
    const modalitiesCount = await prisma.courseModality.count({
      where: {
        id: {
          in: modalityIds
        }
      }
    });

    if (modalitiesCount !== modalityIds.length) {
      return res.status(400).json({ error: 'Uma ou mais modalidades de curso não foram encontradas' });
    }

    // Criar o curso com o relacionamento muitos-para-muitos
    const course = await prisma.$transaction(async (prisma) => {
      // Criar o curso
      const newCourse = await prisma.course.create({
        data: {
          code,
          name,
          description
        }
      });

      // Criar os relacionamentos com as modalidades
      for (const modalityId of modalityIds) {
        await prisma.courseToModality.create({
          data: {
            courseId: newCourse.id,
            courseModalityId: modalityId
          }
        });
      }

      // Buscar o curso completo com as modalidades
      return prisma.course.findUnique({
        where: { id: newCourse.id },
        include: {
          courseToModality: {
            include: {
              courseModality: true
            }
          }
        }
      });
    });

    // Transformar os dados para uma estrutura mais amigável para o frontend
    if (course) {
      const { courseToModality, ...courseData } = course;
      const formattedCourse = {
        ...courseData,
        modalities: courseToModality.map(ctm => ctm.courseModality)
      };

      return res.status(201).json(formattedCourse);
    }

    return res.status(500).json({ error: 'Erro ao criar curso' });
  } catch (error) {
    console.error('Erro ao criar curso:', error);
    return res.status(500).json({ error: 'Erro ao criar curso' });
  }
};

/**
 * Atualizar um curso existente
 */
export const updateCourse = async (req: Request, res: Response) => {
  const { id } = req.params;
  const courseId = Number.parseInt(id, 10);

  if (Number.isNaN(courseId)) {
    return res.status(400).json({ error: 'ID do curso inválido' });
  }

  const validationResult = validateRequestBody(req.body, courseSchema);
  if (!validationResult.success) {
    return res.status(400).json({ error: validationResult.error });
  }

  const { name, description, modalityIds } = req.body;

  try {
    // Verificar se o curso existe
    const existingCourse = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!existingCourse) {
      return res.status(404).json({ error: 'Curso não encontrado' });
    }

    // Verificar se todas as modalidades de curso existem
    const modalitiesCount = await prisma.courseModality.count({
      where: {
        id: {
          in: modalityIds
        }
      }
    });

    if (modalitiesCount !== modalityIds.length) {
      return res.status(400).json({ error: 'Uma ou mais modalidades de curso não foram encontradas' });
    }

    // Atualizar o curso com o relacionamento muitos-para-muitos
    const course = await prisma.$transaction(async (prisma) => {
      // Atualizar o curso
      const updatedCourse = await prisma.course.update({
        where: { id: courseId },
        data: {
          name,
          description
        }
      });

      // Remover todos os relacionamentos existentes
      await prisma.courseToModality.deleteMany({
        where: {
          courseId
        }
      });

      // Criar os novos relacionamentos
      for (const modalityId of modalityIds) {
        await prisma.courseToModality.create({
          data: {
            courseId,
            courseModalityId: modalityId
          }
        });
      }

      // Buscar o curso atualizado com as modalidades
      return prisma.course.findUnique({
        where: { id: courseId },
        include: {
          courseToModality: {
            include: {
              courseModality: true
            }
          }
        }
      });
    });

    // Transformar os dados para uma estrutura mais amigável para o frontend
    if (course) {
      const { courseToModality, ...courseData } = course;
      const formattedCourse = {
        ...courseData,
        modalities: courseToModality.map(ctm => ctm.courseModality)
      };

      return res.status(200).json(formattedCourse);
    }

    return res.status(500).json({ error: 'Erro ao atualizar curso' });
  } catch (error) {
    console.error('Erro ao atualizar curso:', error);
    return res.status(500).json({ error: 'Erro ao atualizar curso' });
  }
};

/**
 * Excluir um curso
 */
export const deleteCourse = async (req: Request, res: Response) => {
  const { id } = req.params;
  const courseId = Number.parseInt(id, 10);

  if (Number.isNaN(courseId)) {
    return res.status(400).json({ error: 'ID do curso inválido' });
  }

  try {
    // Verificar se o curso existe
    const existingCourse = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!existingCourse) {
      return res.status(404).json({ error: 'Curso não encontrado' });
    }

    // Verificar se há alunos usando este curso
    const studentsUsingCourse = await prisma.student.count({
      where: { courseId }
    });

    if (studentsUsingCourse > 0) {
      return res.status(400).json({ 
        error: 'Não é possível excluir este curso pois existem alunos associados a ele' 
      });
    }

    // Excluir o curso e seus relacionamentos
    await prisma.$transaction(async (prisma) => {
      // Remover todos os relacionamentos com modalidades
      await prisma.courseToModality.deleteMany({
        where: { courseId }
      });

      // Excluir o curso
      await prisma.course.delete({
        where: { id: courseId }
      });
    });

    return res.status(200).json({ message: 'Curso excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir curso:', error);
    return res.status(500).json({ error: 'Erro ao excluir curso' });
  }
}; 