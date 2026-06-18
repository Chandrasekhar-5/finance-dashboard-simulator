import { z } from 'zod';


export const registerSchema = z.object({
    body: z.object({
        firstName: z.string().min(1, 'First name is required'),
        lastName: z.string().min(1, 'Last name is required'),
        email: z.string().email('Invalid email format'),
        password: z.string().min(8, 'Password must be at least 8 characters long')
            .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
            .regex(/[0-9]/, 'Password must contain at least one number')
    })
});

export const resendVerificationEmail = z.object({
    body: z.object({
        email: z.string().email('Invalid email format')
    })
});

export const loginSchema = z.object({
    body: z.object({
        email: z.string().email('Invalid email format'),
        password: z.string()
    })
});

export const forgotPasswordSchema = z.object({
    body: z.object({
        email: z.string().email('Invalid email format')
    })
});

export const resetPasswordSchema = z.object({
    body: z.object({
        token: z.string().min(1, 'Reset token is required'),
        newPassword: z.string().min(8, 'Password must be at least 8 characters long')
            .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
            .regex(/[0-9]/, 'Password must contain at least one number')
    })
});

export const changePasswordSchema = z.object({
    body: z.object({
        currentPassword: z.string().min(8, 'Password must be at least 8 characters long'),
        newPassword: z.string().min(8, 'Password must be at least 8 characters long')
            .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
            .regex(/[0-9]/, 'Password must contain at least one number')
    })
});