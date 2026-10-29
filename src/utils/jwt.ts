import jwt from 'jsonwebtoken';
import { AppError } from './appError.js';

interface JwtPayload {
    userId: string;
    email: string;
    systemRole: string;
}

export const signToken = (payload: JwtPayload): string => {
    const secretKey = process.env.JWT_SECRET_KEY

    if (!secretKey) {
        throw new AppError('JWT secret key is not defined in environment variables', 500);
    }

    return jwt.sign(payload, secretKey, { expiresIn: '7d' });
}

export const verifyToken = (token: string): JwtPayload => {
    const secretKey = process.env.JWT_SECRET_KEY

    if (!secretKey) {
        throw new AppError('JWT secret key is not defined in environment variables', 500);
    }

    try {
        const decoded = jwt.verify(token, secretKey) as JwtPayload;
        return decoded;
    } catch (error) {
        throw new AppError('Invalid or expired token', 401);
    }   
}