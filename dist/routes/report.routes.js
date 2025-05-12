"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const report_controller_1 = require("../controllers/report.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validation_middleware_1 = require("../middlewares/validation.middleware");
const report_schema_1 = require("../models/schemas/report.schema");
const router = (0, express_1.Router)();
// Todas as rotas de relatórios requerem autenticação
router.use(auth_middleware_1.authenticate);
// Rota para geração de relatórios com filtros avançados
router.get('/', (0, validation_middleware_1.validate)(report_schema_1.reportFiltersSchema, 'query'), report_controller_1.generateReport);
// Rota para geração de estatísticas
router.get('/statistics', (0, validation_middleware_1.validate)(report_schema_1.reportFiltersSchema, 'query'), report_controller_1.generateStatistics);
// Rota para exportação de relatórios
router.get('/export', (0, validation_middleware_1.validate)(report_schema_1.reportExportSchema, 'query'), report_controller_1.exportReport);
exports.default = router;
