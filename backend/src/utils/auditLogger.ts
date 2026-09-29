import type { Request } from 'express';
import { AuditAction, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface AuditLogOptions {
    userId?: string | null | undefined;
    action: AuditAction;
    resource: string;
    ipAddress?: string | null | undefined;
    userAgent?: string | null | undefined;
    metadata?: Record<string, unknown> | null | undefined;
}

export const extractRequestContext = (req?: Request): { ipAddress: string | null; userAgent: string | null } => {
    if (!req) return { ipAddress: null, userAgent: null };
    const rawIp = req.ip || req.socket?.remoteAddress || '';
    const ipAddress = typeof rawIp === 'string' && rawIp.length > 0 ? rawIp.replace(/^::ffff:/, '') : null;
    const userAgent = (req.headers?.['user-agent'] as string) || null;
    return { ipAddress, userAgent };
};

const SENSITIVE_KEYS = new Set([
    'password',
    'passwordhash',
    'token',
    'tokenhash',
    'accesstoken',
    'refreshtoken',
    'verificationtoken',
    'resettoken',
    'currentpassword',
    'newpassword',
    'secret',
    'clientsecret',
    'authorization',
]);

export const sanitizeMetadata = (obj: unknown): Prisma.InputJsonValue | undefined => {
    if (obj === null || obj === undefined) return undefined;
    if (typeof obj !== 'object') return obj as Prisma.InputJsonValue;

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeMetadata(item)) as Prisma.InputJsonValue;
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        if (SENSITIVE_KEYS.has(key.toLowerCase())) {
            continue; // Omit sensitive keys completely
        }
        if (value instanceof Prisma.Decimal) {
            sanitized[key] = value.toString();
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeMetadata(value);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized as Prisma.InputJsonValue;
};

export const AuditLogger = {
    async log(options: AuditLogOptions): Promise<void> {
        try {
            const sanitizedMeta = options.metadata ? sanitizeMetadata(options.metadata) : undefined;

            await prisma.auditLog.create({
                data: {
                    userId: options.userId ?? null,
                    action: options.action,
                    resource: options.resource,
                    ipAddress: options.ipAddress ?? null,
                    userAgent: options.userAgent ?? null,
                    metadata: sanitizedMeta ?? Prisma.DbNull,
                },
            });
        } catch (error: unknown) {
            // Best-effort logging: Never fail the request or leak secrets in logs
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[AuditLogger] Failed to write audit log for action ${options.action}: ${errorMessage}`);
        }
    },
};
