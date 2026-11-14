import { describe, it, expect } from 'vitest'

describe('test infrastructure', () => {
  it('runs vitest with the @ alias resolved', async () => {
    const mod = await import('@/lib/utils')
    expect(typeof mod.cn).toBe('function')
  })
})
