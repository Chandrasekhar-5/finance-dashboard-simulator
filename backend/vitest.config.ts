import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Use 'forks' pool so each test file runs in a separate Node.js process.
        // This is required for ESM (nodenext) compatibility and keeps vi.mock()
        // isolation clean across files.
        pool: 'forks',

        // Global test environment
        environment: 'node',

        // Setup file runs before every test file
        setupFiles: ['./src/tests/setup.ts'],

        // Pattern for test files — only project source, not node_modules
        include: ['src/**/*.test.ts'],

        // Coverage (opt-in, run with: vitest run --coverage)
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/tests/**', 'src/server.ts'],
        },
    },
});
