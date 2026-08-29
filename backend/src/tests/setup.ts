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
        updateMany: vi.fn(),
    },
    refreshToken: {
        findFirst:  vi.fn(),
        findMany:   vi.fn(),
        create:     vi.fn(),
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
});
