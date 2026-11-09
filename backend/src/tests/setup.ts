/**
 * Global test setup.
 *
 * This file is loaded before every test file via vitest `setupFiles`.
 *
 * It mocks the Prisma client (`../../lib/prisma`) so tests never reach the
 * real database. Each test can then override specific prisma methods with
 * vi.mocked(...).mockResolvedValue(...) for the specific scenario under test.
 *
 * The mock is reset before each test via `beforeEach` to prevent bleed-through
 * between cases.
 */

import { vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Prisma mock factory
// The mock object mirrors the methods used across the services. Extend as new
// methods are used in tests.
// ---------------------------------------------------------------------------

export const prismaMock = {
    account: {
        findFirst:  vi.fn(),
        findUnique: vi.fn(),
        findMany:   vi.fn(),
        create:     vi.fn(),
        update:     vi.fn(),
        updateMany: vi.fn(),
    },
    transaction: {
        findMany:   vi.fn(),
        create:     vi.fn(),
        aggregate:  vi.fn(),
    },
    user: {
        findUnique: vi.fn(),
        findFirst:  vi.fn(),
        create:     vi.fn(),
        update:     vi.fn(),
        updateMany: vi.fn(),
    },
    refreshToken: {
        findFirst:  vi.fn(),
        findMany:   vi.fn(),
        create:     vi.fn(),
        deleteMany: vi.fn(),
    },
    emailVerification: {
        findFirst:  vi.fn(),
        create:     vi.fn(),
        update:     vi.fn(),
        deleteMany: vi.fn(),
    },
    passwordReset: {
        findFirst:  vi.fn(),
        create:     vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
    },
    auditLog: {
        create:     vi.fn(),
        findMany:   vi.fn(),
    },
    oAuthAccount: {
        findUnique: vi.fn(),
        findFirst:  vi.fn(),
        create:     vi.fn(),
        update:     vi.fn(),
        deleteMany: vi.fn(),
    },
    oAuthTicket: {
        findUnique: vi.fn(),
        findFirst:  vi.fn(),
        create:     vi.fn(),
        update:     vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
};

// Replace the real prisma singleton with the mock before any module that
// imports '../../lib/prisma' gets loaded.
vi.mock('../lib/prisma.js', () => ({
    prisma: prismaMock,
}));

// Reset all mock state before each test so cases are fully isolated.
beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: null } });
    prismaMock.account.findUnique.mockResolvedValue({
        id: 'acc-receiver',
        userId: 'user-2',
        accountNumber: '2222222222',
        type: 'CHECKING',
        status: 'ACTIVE',
        balance: '1000.0000',
        currency: 'INR',
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    const mockTickets: Array<any> = [];
    prismaMock.oAuthTicket.create.mockImplementation(async ({ data }: any) => {
        const record = {
            id: 'mock-ticket-' + Math.random().toString(36).substring(7),
            ...data,
            createdAt: new Date(),
            usedAt: null,
        };
        mockTickets.push(record);
        return record;
    });
    prismaMock.oAuthTicket.updateMany.mockImplementation(async ({ where, data }: any) => {
        let count = 0;
        for (const t of mockTickets) {
            const hashMatch = !where.ticketHash || t.ticketHash === where.ticketHash;
            const usedMatch = where.usedAt === null ? t.usedAt === null : true;
            const expiryMatch = where.expiresAt?.gt ? t.expiresAt > where.expiresAt.gt : true;
            if (hashMatch && usedMatch && expiryMatch) {
                if (data.usedAt !== undefined) t.usedAt = data.usedAt;
                count++;
            }
        }
        return { count };
    });
    prismaMock.oAuthTicket.findUnique.mockImplementation(async ({ where }: any) => {
        return mockTickets.find(t => t.ticketHash === where.ticketHash) ?? null;
    });
    prismaMock.oAuthTicket.deleteMany.mockImplementation(async () => {
        mockTickets.length = 0;
        return { count: 0 };
    });
});
