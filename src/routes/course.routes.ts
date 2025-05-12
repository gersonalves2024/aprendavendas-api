import { Router } from 'express';
import { 
  getAllCourseTypes, 
  getCourseTypeById, 
  createCourseType, 
  updateCourseType, 
  deleteCourseType,
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

// Rotas para CourseModality
router.get('/course-modalities', authenticate, getAllCourseModalities);
router.get('/course-modalities/:id', authenticate, getCourseModalityById);
router.post('/course-modalities', authenticate, requireAdmin, createCourseModality);
router.put('/course-modalities/:id', authenticate, requireAdmin, updateCourseModality);
router.delete('/course-modalities/:id', authenticate, requireAdmin, deleteCourseModality);

// Rotas para CourseType
router.get('/course-types', authenticate, getAllCourseTypes);
router.get('/course-types/:id', authenticate, getCourseTypeById);
router.post('/course-types', authenticate, requireAdmin, createCourseType);
router.put('/course-types/:id', authenticate, requireAdmin, updateCourseType);
router.delete('/course-types/:id', authenticate, requireAdmin, deleteCourseType);

// Rotas para Course
router.get('/courses', authenticate, getAllCourses);
router.get('/courses/:id', authenticate, getCourseById);
router.post('/courses', authenticate, requireAdmin, createCourse);
router.put('/courses/:id', authenticate, requireAdmin, updateCourse);
router.delete('/courses/:id', authenticate, requireAdmin, deleteCourse);

export default router; 