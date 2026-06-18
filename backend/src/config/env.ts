import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();


const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('5000'),
    DATABASE_URL: z.string(),
    ACCESS_TOKEN_SECRET: z.string(),
    REFRESH_TOKEN_SECRET: z.string(),
    FRONTEND_URL: z.string().default('http://localhost:5173'),
    RESEND_API_KEY: z.string(),
    EMAIL_FROM: z.string().default('noreply@chandrasekhar.xyz'),
    GOOGLE_CLIENT_ID: z.string(),
    GOOGLE_CLIENT_SECRET: z.string(),
    GOOGLE_CALLBACK_URL: z.string().default('http://localhost:5000/api/v1/auth/google/callback')
});


const _env = envSchema.safeParse(process.env);

if (!_env.success) {
    console.error('Invalid environment variables:', _env.error.format());
    process.exit(1);
}

export const env = _env.data;