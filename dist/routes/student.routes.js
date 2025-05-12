"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const student_controller_1 = require("../controllers/student.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validation_middleware_1 = require("../middlewares/validation.middleware");
const student_schema_1 = require("../models/schemas/student.schema");
const router = (0, express_1.Router)();
// Todas as rotas de alunos requerem autenticação
router.use(auth_middleware_1.authenticate);
// Rotas para gerenciamento de alunos
router.post('/', (0, validation_middleware_1.validate)(student_schema_1.createStudentSchema), student_controller_1.createStudent);
router.get('/', (0, validation_middleware_1.validate)(student_schema_1.paginationSchema, 'query'), (0, validation_middleware_1.validate)(student_schema_1.filtersSchema, 'query'), student_controller_1.getStudents);
router.get('/:id', student_controller_1.getStudentById);
router.put('/:id', (0, validation_middleware_1.validate)(student_schema_1.updateStudentSchema), student_controller_1.updateStudent);
router.delete('/:id', auth_middleware_1.requireAdmin, student_controller_1.deleteStudent);
exports.default = router;
