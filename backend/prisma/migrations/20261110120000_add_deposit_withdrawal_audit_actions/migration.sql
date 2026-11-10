-- AlterEnum: Add DEPOSIT and WITHDRAWAL values to AuditAction
-- Note: PostgreSQL requires each ALTER TYPE ... ADD VALUE to be a separate statement.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DEPOSIT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'WITHDRAWAL';
