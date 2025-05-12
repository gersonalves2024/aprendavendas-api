"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validation_middleware_1 = require("../middlewares/validation.middleware");
const auth_schema_1 = require("../models/schemas/auth.schema");
const router = (0, express_1.Router)();
// Rota para registro (apenas administradores podem cadastrar novos usuários)
router.post('/register', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, (0, validation_middleware_1.validate)(auth_schema_1.registerSchema), auth_controller_1.register);
// Rota para login
router.post('/login', (0, validation_middleware_1.validate)(auth_schema_1.loginSchema), auth_controller_1.login);
// Rota para renovar token
router.post('/refresh-token', (0, validation_middleware_1.validate)(auth_schema_1.refreshTokenSchema), auth_controller_1.refreshToken);
// Rota para logout
router.post('/logout', auth_middleware_1.authenticate, auth_controller_1.logout);
exports.default = router;
