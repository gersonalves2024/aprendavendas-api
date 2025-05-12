"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAuthTokens = exports.verifyRefreshToken = exports.verifyToken = exports.generateRefreshToken = exports.generateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
/**
 * Gera um token JWT
 */
const generateToken = (payload) => {
    const secret = process.env.JWT_SECRET || 'fallback_secret';
    const expiresIn = process.env.JWT_EXPIRES_IN || '1h';
    return jsonwebtoken_1.default.sign(payload, secret, { expiresIn });
};
exports.generateToken = generateToken;
/**
 * Gera um refresh token
 */
const generateRefreshToken = (payload) => {
    const secret = process.env.REFRESH_TOKEN_SECRET || 'refresh_fallback_secret';
    const expiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
    return jsonwebtoken_1.default.sign(payload, secret, { expiresIn });
};
exports.generateRefreshToken = generateRefreshToken;
/**
 * Verifica e decodifica um token JWT
 */
const verifyToken = (token) => {
    try {
        const secret = process.env.JWT_SECRET || 'fallback_secret';
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        return decoded;
    }
    catch (error) {
        return null;
    }
};
exports.verifyToken = verifyToken;
/**
 * Verifica e decodifica um refresh token
 */
const verifyRefreshToken = (token) => {
    try {
        const secret = process.env.REFRESH_TOKEN_SECRET || 'refresh_fallback_secret';
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        return decoded;
    }
    catch (error) {
        return null;
    }
};
exports.verifyRefreshToken = verifyRefreshToken;
/**
 * Gera tokens de autenticação e estrutura a resposta
 */
const generateAuthTokens = (user) => {
    const payload = {
        userId: user.id,
        email: user.email,
        role: user.role
    };
    const token = (0, exports.generateToken)(payload);
    const refreshToken = (0, exports.generateRefreshToken)(payload);
    return {
        token,
        refreshToken,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        }
    };
};
exports.generateAuthTokens = generateAuthTokens;
