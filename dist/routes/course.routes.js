"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const course_controller_1 = require("../controllers/course.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Rotas para tipos de curso
router.get('/course-types', auth_middleware_1.authenticate, course_controller_1.getAllCourseTypes);
router.get('/course-types/:id', auth_middleware_1.authenticate, course_controller_1.getCourseTypeById);
router.post('/course-types', [auth_middleware_1.authenticate, auth_middleware_1.requireAdmin], course_controller_1.createCourseType);
router.put('/course-types/:id', [auth_middleware_1.authenticate, auth_middleware_1.requireAdmin], course_controller_1.updateCourseType);
router.delete('/course-types/:id', [auth_middleware_1.authenticate, auth_middleware_1.requireAdmin], course_controller_1.deleteCourseType);
// Rotas para cursos
router.get('/courses', auth_middleware_1.authenticate, course_controller_1.getAllCourses);
router.get('/courses/:id', auth_middleware_1.authenticate, course_controller_1.getCourseById);
router.post('/courses', [auth_middleware_1.authenticate, auth_middleware_1.requireAdmin], course_controller_1.createCourse);
router.put('/courses/:id', [auth_middleware_1.authenticate, auth_middleware_1.requireAdmin], course_controller_1.updateCourse);
router.delete('/courses/:id', [auth_middleware_1.authenticate, auth_middleware_1.requireAdmin], course_controller_1.deleteCourse);
exports.default = router;
