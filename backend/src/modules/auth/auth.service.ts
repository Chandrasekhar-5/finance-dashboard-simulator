import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../utils/AppError.js';
import { env } from '../../config/env.js';

const prisma = new PrismaClient();

interface RegisterInput {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
}

interface LoginInput {
    email: string;
    password: string;
}

export const AuthService = {
    async register(data: RegisterInput) {
        const existingUser = await prisma.user.findUnique({ where: { email: data.email } });

        if (existingUser) {
            throw new AppError('Email already in use', 409);
        }

        const passwordHash = await bcrypt.hash(data.password, 10);

        const user = await prisma.user.create({
            data: {
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                passwordHash: passwordHash
            }
        });
        return this.generateToken(user.id);
    },

    async login(data: LoginInput) {
        const user = await prisma.user.findUnique({ where: { email: data.email } });

        if (!user) throw new AppError('Invalid email or password', 401);

        const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
        if (!isPasswordValid) throw new AppError('Invalid creadentials', 401);

        return this.generateToken(user.id);
    },

    async generateToken(userId: string) {
        const accessToken = jwt.sign({ userId }, env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
        const refreshToken = jwt.sign({ userId }, env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

        return { accessToken, refreshToken, userId };
    }
};