import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { validateRequestBody } from '../utils/validation';
import { z } from 'zod';

const prisma = new PrismaClient();

/**
 * Validadores usando Zod para garantir a integridade dos dados
 */
const courseTypeSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório').max(20, 'Código deve ter no máximo 20 caracteres'),
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  description: z.string().optional(),
});

const courseModalitySchema = z.object({
  code: z.string().min(1, 'Código é obrigatório').max(20, 'Código deve ter no máximo 20 caracteres'),
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  description: z.string().optional(),
});

const courseSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório').max(20, 'Código deve ter no máximo 20 caracteres'),
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  description: z.string().optional(),
  courseTypeId: z.number().int().positive('ID do tipo de curso deve ser um número positivo'),
  courseModalityId: z.number().int().positive('ID da modalidade de curso deve ser um número positivo'),
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
  const modalityId = parseInt(id, 10);

  if (isNaN(modalityId)) {
    return res.status(400).json({ error: 'ID da modalidade de curso inválido' });
  }

  try {
    const courseModality = await prisma.courseModality.findUnique({
      where: { id: modalityId }
    });

    if (!courseModality) {
      return res.status(404).json({ error: 'Modalidade de curso não encontrada' });
    }

    return res.status(200).json(courseModality);
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
    // Verificar se já existe uma modalidade de curso com o mesmo código
    const existingCourseModality = await prisma.courseModality.findUnique({
      where: { code: req.body.code }
    });

    if (existingCourseModality) {
      return res.status(400).json({ error: 'Já existe uma modalidade de curso com este código' });
    }

    const courseModality = await prisma.courseModality.create({
      data: req.body
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
  const modalityId = parseInt(id, 10);

  if (isNaN(modalityId)) {
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

    // Verificar se já existe outra modalidade de curso com o mesmo código
    if (req.body.code !== existingCourseModality.code) {
      const codeExists = await prisma.courseModality.findUnique({
        where: { code: req.body.code }
      });

      if (codeExists) {
        return res.status(400).json({ error: 'Já existe uma modalidade de curso com este código' });
      }
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
  const modalityId = parseInt(id, 10);

  if (isNaN(modalityId)) {
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
    const coursesUsingModality = await prisma.course.count({
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
 * Obter todos os tipos de curso
 */
export const getAllCourseTypes = async (req: Request, res: Response) => {
  try {
    const courseTypes = await prisma.courseType.findMany({
      orderBy: { name: 'asc' }
    });
    return res.status(200).json(courseTypes);
  } catch (error) {
    console.error('Erro ao buscar tipos de curso:', error);
    return res.status(500).json({ error: 'Erro ao buscar tipos de curso' });
  }
};

/**
 * Obter um tipo de curso pelo ID
 */
export const getCourseTypeById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const typeId = parseInt(id, 10);

  if (isNaN(typeId)) {
    return res.status(400).json({ error: 'ID do tipo de curso inválido' });
  }

  try {
    const courseType = await prisma.courseType.findUnique({
      where: { id: typeId }
    });

    if (!courseType) {
      return res.status(404).json({ error: 'Tipo de curso não encontrado' });
    }

    return res.status(200).json(courseType);
  } catch (error) {
    console.error('Erro ao buscar tipo de curso:', error);
    return res.status(500).json({ error: 'Erro ao buscar tipo de curso' });
  }
};

/**
 * Criar um novo tipo de curso
 */
export const createCourseType = async (req: Request, res: Response) => {
  const validationResult = validateRequestBody(req.body, courseTypeSchema);
  if (!validationResult.success) {
    return res.status(400).json({ error: validationResult.error });
  }

  try {
    // Verificar se já existe um tipo de curso com o mesmo código
    const existingCourseType = await prisma.courseType.findUnique({
      where: { code: req.body.code }
    });

    if (existingCourseType) {
      return res.status(400).json({ error: 'Já existe um tipo de curso com este código' });
    }

    const courseType = await prisma.courseType.create({
      data: req.body
    });

    return res.status(201).json(courseType);
  } catch (error) {
    console.error('Erro ao criar tipo de curso:', error);
    return res.status(500).json({ error: 'Erro ao criar tipo de curso' });
  }
};

/**
 * Atualizar um tipo de curso existente
 */
export const updateCourseType = async (req: Request, res: Response) => {
  const { id } = req.params;
  const typeId = parseInt(id, 10);

  if (isNaN(typeId)) {
    return res.status(400).json({ error: 'ID do tipo de curso inválido' });
  }

  const validationResult = validateRequestBody(req.body, courseTypeSchema);
  if (!validationResult.success) {
    return res.status(400).json({ error: validationResult.error });
  }

  try {
    // Verificar se o tipo de curso existe
    const existingCourseType = await prisma.courseType.findUnique({
      where: { id: typeId }
    });

    if (!existingCourseType) {
      return res.status(404).json({ error: 'Tipo de curso não encontrado' });
    }

    // Verificar se já existe outro tipo de curso com o mesmo código
    if (req.body.code !== existingCourseType.code) {
      const codeExists = await prisma.courseType.findUnique({
        where: { code: req.body.code }
      });

      if (codeExists) {
        return res.status(400).json({ error: 'Já existe um tipo de curso com este código' });
      }
    }

    const courseType = await prisma.courseType.update({
      where: { id: typeId },
      data: req.body
    });

    return res.status(200).json(courseType);
  } catch (error) {
    console.error('Erro ao atualizar tipo de curso:', error);
    return res.status(500).json({ error: 'Erro ao atualizar tipo de curso' });
  }
};

/**
 * Excluir um tipo de curso
 */
export const deleteCourseType = async (req: Request, res: Response) => {
  const { id } = req.params;
  const typeId = parseInt(id, 10);

  if (isNaN(typeId)) {
    return res.status(400).json({ error: 'ID do tipo de curso inválido' });
  }

  try {
    // Verificar se o tipo de curso existe
    const existingCourseType = await prisma.courseType.findUnique({
      where: { id: typeId }
    });

    if (!existingCourseType) {
      return res.status(404).json({ error: 'Tipo de curso não encontrado' });
    }

    // Verificar se há cursos usando este tipo
    const coursesUsingType = await prisma.course.count({
      where: { courseTypeId: typeId }
    });

    if (coursesUsingType > 0) {
      return res.status(400).json({ 
        error: 'Não é possível excluir este tipo de curso pois existem cursos associados a ele' 
      });
    }

    await prisma.courseType.delete({
      where: { id: typeId }
    });

    return res.status(200).json({ message: 'Tipo de curso excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir tipo de curso:', error);
    return res.status(500).json({ error: 'Erro ao excluir tipo de curso' });
  }
};

/**
 * Obter todos os cursos
 */
export const getAllCourses = async (req: Request, res: Response) => {
  try {
    const { courseTypeId } = req.query;
    let where = {};
    
    if (courseTypeId) {
      const typeId = parseInt(courseTypeId as string, 10);
      if (!isNaN(typeId)) {
        where = { courseTypeId: typeId };
      }
    }

    const courses = await prisma.course.findMany({
      where,
      include: { 
        courseType: true,
        courseModality: true 
      },
      orderBy: { name: 'asc' }
    });

    return res.status(200).json(courses);
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
  const courseId = parseInt(id, 10);

  if (isNaN(courseId)) {
    return res.status(400).json({ error: 'ID do curso inválido' });
  }

  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { 
        courseType: true,
        courseModality: true 
      }
    });

    if (!course) {
      return res.status(404).json({ error: 'Curso não encontrado' });
    }

    return res.status(200).json(course);
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

  try {
    // Verificar se já existe um curso com o mesmo código
    const existingCourse = await prisma.course.findUnique({
      where: { code: req.body.code }
    });

    if (existingCourse) {
      return res.status(400).json({ error: 'Já existe um curso com este código' });
    }

    // Verificar se o tipo de curso existe
    const courseType = await prisma.courseType.findUnique({
      where: { id: req.body.courseTypeId }
    });

    if (!courseType) {
      return res.status(400).json({ error: 'Tipo de curso não encontrado' });
    }
    
    // Verificar se a modalidade de curso existe
    const courseModality = await prisma.courseModality.findUnique({
      where: { id: req.body.courseModalityId }
    });

    if (!courseModality) {
      return res.status(400).json({ error: 'Modalidade de curso não encontrada' });
    }

    const course = await prisma.course.create({
      data: req.body,
      include: { 
        courseType: true,
        courseModality: true 
      }
    });

    return res.status(201).json(course);
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
  const courseId = parseInt(id, 10);

  if (isNaN(courseId)) {
    return res.status(400).json({ error: 'ID do curso inválido' });
  }

  const validationResult = validateRequestBody(req.body, courseSchema);
  if (!validationResult.success) {
    return res.status(400).json({ error: validationResult.error });
  }

  try {
    // Verificar se o curso existe
    const existingCourse = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!existingCourse) {
      return res.status(404).json({ error: 'Curso não encontrado' });
    }

    // Verificar se já existe outro curso com o mesmo código
    if (req.body.code !== existingCourse.code) {
      const codeExists = await prisma.course.findUnique({
        where: { code: req.body.code }
      });

      if (codeExists) {
        return res.status(400).json({ error: 'Já existe um curso com este código' });
      }
    }

    // Verificar se o tipo de curso existe
    const courseType = await prisma.courseType.findUnique({
      where: { id: req.body.courseTypeId }
    });

    if (!courseType) {
      return res.status(400).json({ error: 'Tipo de curso não encontrado' });
    }

    // Verificar se a modalidade de curso existe
    const courseModality = await prisma.courseModality.findUnique({
      where: { id: req.body.courseModalityId }
    });

    if (!courseModality) {
      return res.status(400).json({ error: 'Modalidade de curso não encontrada' });
    }

    const course = await prisma.course.update({
      where: { id: courseId },
      data: req.body,
      include: { 
        courseType: true,
        courseModality: true 
      }
    });

    return res.status(200).json(course);
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
  const courseId = parseInt(id, 10);

  if (isNaN(courseId)) {
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

    await prisma.course.delete({
      where: { id: courseId }
    });

    return res.status(200).json({ message: 'Curso excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir curso:', error);
    return res.status(500).json({ error: 'Erro ao excluir curso' });
  }
}; 