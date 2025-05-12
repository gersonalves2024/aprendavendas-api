"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCourse = exports.updateCourse = exports.createCourse = exports.getCourseById = exports.getAllCourses = exports.deleteCourseType = exports.updateCourseType = exports.createCourseType = exports.getCourseTypeById = exports.getAllCourseTypes = void 0;
const client_1 = require("@prisma/client");
const validation_1 = require("../utils/validation");
const zod_1 = require("zod");
const prisma = new client_1.PrismaClient();
/**
 * Validadores usando Zod para garantir a integridade dos dados
 */
const courseTypeSchema = zod_1.z.object({
    code: zod_1.z.string().min(1, 'Código é obrigatório').max(20, 'Código deve ter no máximo 20 caracteres'),
    name: zod_1.z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
    description: zod_1.z.string().optional(),
});
const courseSchema = zod_1.z.object({
    code: zod_1.z.string().min(1, 'Código é obrigatório').max(20, 'Código deve ter no máximo 20 caracteres'),
    name: zod_1.z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
    description: zod_1.z.string().optional(),
    courseTypeId: zod_1.z.number().int().positive('ID do tipo de curso deve ser um número positivo'),
});
/**
 * Obter todos os tipos de curso
 */
const getAllCourseTypes = async (req, res) => {
    try {
        const courseTypes = await prisma.courseType.findMany({
            orderBy: { name: 'asc' }
        });
        return res.status(200).json(courseTypes);
    }
    catch (error) {
        console.error('Erro ao buscar tipos de curso:', error);
        return res.status(500).json({ error: 'Erro ao buscar tipos de curso' });
    }
};
exports.getAllCourseTypes = getAllCourseTypes;
/**
 * Obter um tipo de curso pelo ID
 */
const getCourseTypeById = async (req, res) => {
    try {
        const { id } = req.params;
        const courseType = await prisma.courseType.findUnique({
            where: { id: Number(id) }
        });
        if (!courseType) {
            return res.status(404).json({ error: 'Tipo de curso não encontrado' });
        }
        return res.status(200).json(courseType);
    }
    catch (error) {
        console.error('Erro ao buscar tipo de curso:', error);
        return res.status(500).json({ error: 'Erro ao buscar tipo de curso' });
    }
};
exports.getCourseTypeById = getCourseTypeById;
/**
 * Criar um novo tipo de curso
 */
const createCourseType = async (req, res) => {
    const validationResult = (0, validation_1.validateRequestBody)(req.body, courseTypeSchema);
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
    }
    catch (error) {
        console.error('Erro ao criar tipo de curso:', error);
        return res.status(500).json({ error: 'Erro ao criar tipo de curso' });
    }
};
exports.createCourseType = createCourseType;
/**
 * Atualizar um tipo de curso existente
 */
const updateCourseType = async (req, res) => {
    const validationResult = (0, validation_1.validateRequestBody)(req.body, courseTypeSchema);
    if (!validationResult.success) {
        return res.status(400).json({ error: validationResult.error });
    }
    try {
        const { id } = req.params;
        const courseTypeId = Number(id);
        // Verificar se o tipo de curso existe
        const existingCourseType = await prisma.courseType.findUnique({
            where: { id: courseTypeId }
        });
        if (!existingCourseType) {
            return res.status(404).json({ error: 'Tipo de curso não encontrado' });
        }
        // Verificar se o código já está em uso por outro tipo de curso
        if (req.body.code !== existingCourseType.code) {
            const codeInUse = await prisma.courseType.findUnique({
                where: { code: req.body.code }
            });
            if (codeInUse) {
                return res.status(400).json({ error: 'Já existe um tipo de curso com este código' });
            }
        }
        const updatedCourseType = await prisma.courseType.update({
            where: { id: courseTypeId },
            data: req.body
        });
        return res.status(200).json(updatedCourseType);
    }
    catch (error) {
        console.error('Erro ao atualizar tipo de curso:', error);
        return res.status(500).json({ error: 'Erro ao atualizar tipo de curso' });
    }
};
exports.updateCourseType = updateCourseType;
/**
 * Excluir um tipo de curso
 */
const deleteCourseType = async (req, res) => {
    try {
        const { id } = req.params;
        const courseTypeId = Number(id);
        // Verificar se o tipo de curso existe
        const existingCourseType = await prisma.courseType.findUnique({
            where: { id: courseTypeId }
        });
        if (!existingCourseType) {
            return res.status(404).json({ error: 'Tipo de curso não encontrado' });
        }
        // Verificar se existem cursos associados a este tipo
        const coursesCount = await prisma.course.count({
            where: { courseTypeId }
        });
        if (coursesCount > 0) {
            return res.status(400).json({
                error: 'Não é possível excluir este tipo de curso pois existem cursos associados a ele'
            });
        }
        await prisma.courseType.delete({
            where: { id: courseTypeId }
        });
        return res.status(204).send();
    }
    catch (error) {
        console.error('Erro ao excluir tipo de curso:', error);
        return res.status(500).json({ error: 'Erro ao excluir tipo de curso' });
    }
};
exports.deleteCourseType = deleteCourseType;
/**
 * Obter todos os cursos
 */
const getAllCourses = async (req, res) => {
    try {
        const { courseTypeId } = req.query;
        let where = {};
        if (courseTypeId) {
            where = { courseTypeId: Number(courseTypeId) };
        }
        const courses = await prisma.course.findMany({
            where,
            include: { courseType: true },
            orderBy: { name: 'asc' }
        });
        return res.status(200).json(courses);
    }
    catch (error) {
        console.error('Erro ao buscar cursos:', error);
        return res.status(500).json({ error: 'Erro ao buscar cursos' });
    }
};
exports.getAllCourses = getAllCourses;
/**
 * Obter um curso pelo ID
 */
const getCourseById = async (req, res) => {
    try {
        const { id } = req.params;
        const course = await prisma.course.findUnique({
            where: { id: Number(id) },
            include: { courseType: true }
        });
        if (!course) {
            return res.status(404).json({ error: 'Curso não encontrado' });
        }
        return res.status(200).json(course);
    }
    catch (error) {
        console.error('Erro ao buscar curso:', error);
        return res.status(500).json({ error: 'Erro ao buscar curso' });
    }
};
exports.getCourseById = getCourseById;
/**
 * Criar um novo curso
 */
const createCourse = async (req, res) => {
    const validationResult = (0, validation_1.validateRequestBody)(req.body, courseSchema);
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
        const course = await prisma.course.create({
            data: req.body,
            include: { courseType: true }
        });
        return res.status(201).json(course);
    }
    catch (error) {
        console.error('Erro ao criar curso:', error);
        return res.status(500).json({ error: 'Erro ao criar curso' });
    }
};
exports.createCourse = createCourse;
/**
 * Atualizar um curso existente
 */
const updateCourse = async (req, res) => {
    const validationResult = (0, validation_1.validateRequestBody)(req.body, courseSchema);
    if (!validationResult.success) {
        return res.status(400).json({ error: validationResult.error });
    }
    try {
        const { id } = req.params;
        const courseId = Number(id);
        // Verificar se o curso existe
        const existingCourse = await prisma.course.findUnique({
            where: { id: courseId }
        });
        if (!existingCourse) {
            return res.status(404).json({ error: 'Curso não encontrado' });
        }
        // Verificar se o código já está em uso por outro curso
        if (req.body.code !== existingCourse.code) {
            const codeInUse = await prisma.course.findUnique({
                where: { code: req.body.code }
            });
            if (codeInUse) {
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
        const updatedCourse = await prisma.course.update({
            where: { id: courseId },
            data: req.body,
            include: { courseType: true }
        });
        return res.status(200).json(updatedCourse);
    }
    catch (error) {
        console.error('Erro ao atualizar curso:', error);
        return res.status(500).json({ error: 'Erro ao atualizar curso' });
    }
};
exports.updateCourse = updateCourse;
/**
 * Excluir um curso
 */
const deleteCourse = async (req, res) => {
    try {
        const { id } = req.params;
        const courseId = Number(id);
        // Verificar se o curso existe
        const existingCourse = await prisma.course.findUnique({
            where: { id: courseId }
        });
        if (!existingCourse) {
            return res.status(404).json({ error: 'Curso não encontrado' });
        }
        // Verificar se existem alunos associados a este curso
        const studentsCount = await prisma.student.count({
            where: { courseId }
        });
        if (studentsCount > 0) {
            return res.status(400).json({
                error: 'Não é possível excluir este curso pois existem alunos associados a ele'
            });
        }
        await prisma.course.delete({
            where: { id: courseId }
        });
        return res.status(204).send();
    }
    catch (error) {
        console.error('Erro ao excluir curso:', error);
        return res.status(500).json({ error: 'Erro ao excluir curso' });
    }
};
exports.deleteCourse = deleteCourse;
