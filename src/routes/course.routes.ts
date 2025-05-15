import { Router } from 'express';
import { 
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  getAllCourseModalities,
  getCourseModalityById,
  createCourseModality,
  updateCourseModality,
  deleteCourseModality
} from '../controllers/course.controller';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

// Rotas para modalidades de curso (exigem autenticação de admin)
router.get('/course-modalities', authenticate, getAllCourseModalities);
router.get('/course-modalities/:id', authenticate, getCourseModalityById);
router.post('/course-modalities', authenticate, requireAdmin, createCourseModality);
router.put('/course-modalities/:id', authenticate, requireAdmin, updateCourseModality);
router.delete('/course-modalities/:id', authenticate, requireAdmin, deleteCourseModality);

// Rotas para cursos (exigem autenticação de admin para criar, atualizar e excluir)
router.get('/courses', authenticate, getAllCourses);
router.get('/courses/:id', authenticate, getCourseById);
router.post('/courses', authenticate, requireAdmin, createCourse);
router.put('/courses/:id', authenticate, requireAdmin, updateCourse);
router.delete('/courses/:id', authenticate, requireAdmin, deleteCourse);

export default router; 