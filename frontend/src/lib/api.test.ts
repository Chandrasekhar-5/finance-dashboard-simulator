import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api, ApiError, authToken, refreshAccessToken } from '@/lib/api'
import type { Account, ApiEnvelope, TransactionHistoryResponse, TransferResult } from '@/types/api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE = 'http://localhost:5000/api/v1'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function emptyResponse(status: number): Response {
  return new Response(null, { status })
}

function envelope<T>(data: T, message?: string): ApiEnvelope<T> {
  return { success: true, data, message }
}

const ACCOUNT_STUB: Account = {
  id: 'acc-1',
  accountNumber: '1234567890',
  type: 'CHECKING',
  status: 'ACTIVE',
  balance: '5000.00',
  currency: 'INR',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const mockFetch = vi.fn()

let lastInit: RequestInit | undefined
let lastUrl: string | undefined
let mockResponse: Response

beforeEach(() => {
  vi.clearAllMocks()
  authToken.set(null)
  localStorage.clear()
  lastInit = undefined
  lastUrl = undefined
  mockResponse = emptyResponse(200)

  global.fetch = mockFetch
  mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    lastUrl = typeof input === 'string' ? input : input.toString()
    lastInit = init
    return mockResponse
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('api client', () => {
  // ---- Successful envelope parsing ----------------------------------------

  describe('successful response envelope parsing', () => {
    it('extracts data from a standard envelope', async () => {
      mockResponse = jsonResponse(200, envelope<Account[]>([ACCOUNT_STUB]))

      const result = await api.accounts()

      expect(result).toEqual([ACCOUNT_STUB])
    })

    it('extracts data from a single-object envelope', async () => {
      mockResponse = jsonResponse(200, envelope<Account>(ACCOUNT_STUB))

      const result = await api.account('acc-1')

      expect(result).toEqual(ACCOUNT_STUB)
    })
  })

  // ---- Error handling -----------------------------------------------------

  describe('API error responses', () => {
    it('preserves HTTP status and backend error message', async () => {
      mockResponse = jsonResponse(403, { success: false, error: 'Account is closed' })

      await expect(api.accounts()).rejects.toMatchObject({
        status: 403,
        message: 'Account is closed',
      })
    })

    it('uses fallback message when body has neither error nor message', async () => {
      mockResponse = jsonResponse(500, { success: false })

      await expect(api.accounts()).rejects.toMatchObject({
        status: 500,
        message: 'Request failed',
      })
    })

    it('falls back when response body is not JSON', async () => {
      mockResponse = new Response('Internal Server Error', { status: 500 })

      await expect(api.accounts()).rejects.toMatchObject({
        status: 500,
        message: 'Request failed',
      })
    })

    it('thrown error is an ApiError instance', async () => {
      mockResponse = jsonResponse(404, { success: false, error: 'Not found' })

      await expect(api.accounts()).rejects.toBeInstanceOf(ApiError)
    })
  })

  // ---- 401 refresh + retry ------------------------------------------------

  describe('401 token refresh and retry', () => {
    it('refreshes access token and retries the original request', async () => {
      const accountsPayload = envelope<Account[]>([ACCOUNT_STUB])
      const refreshPayload = envelope({ userId: 'user-1', accessToken: 'new-token' })

      mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.endsWith('/auth/refresh')) {
          return jsonResponse(200, refreshPayload)
        }
        const accountsCalls = mockFetch.mock.calls.filter(
          c => (typeof c[0] === 'string' ? c[0] : c[0]?.toString())?.includes('/accounts'),
        )
        if (url.includes('/accounts') && accountsCalls.length === 1) {
          return jsonResponse(401, { success: false, error: 'Token expired' })
        }
        return jsonResponse(200, accountsPayload)
      })

      const result = await api.accounts()

      expect(result).toEqual([ACCOUNT_STUB])
      // The retry (second /accounts call) should carry the refreshed token.
      const accountsCalls = mockFetch.mock.calls.filter(
        c => (typeof c[0] === 'string' ? c[0] : c[0]?.toString())?.includes('/accounts'),
      )
      const retryCall = accountsCalls[accountsCalls.length - 1]
      const headers = new Headers(retryCall?.[1]?.headers as HeadersInit)
      expect(headers.get('Authorization')).toBe('Bearer new-token')
    })

    it('propagates authentication failure when refresh returns no token', async () => {
      mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.endsWith('/auth/refresh')) {
          return jsonResponse(401, { success: false, error: 'Refresh token expired' })
        }
        return jsonResponse(401, { success: false, error: 'Token expired' })
      })

      await expect(api.accounts()).rejects.toMatchObject({
        status: 401,
      })
    })
  })

  // ---- Empty / null body handling -----------------------------------------

  describe('empty and null response bodies', () => {
    it('handles 204 No Content safely (request returns undefined)', async () => {
      mockResponse = emptyResponse(204)

      const result = await api.logout()

      expect(result).toBeUndefined()
    })

    it('handles a null body from a 200 safely', async () => {
      mockResponse = new Response('null', { status: 200, headers: { 'Content-Type': 'application/json' } })

      const result = await api.logout()

      expect(result).toBeUndefined()
    })
  })

  // ---- transactionHistory structure ---------------------------------------

  describe('transactionHistory', () => {
    it('returns { data, nextCursor } structure from the envelope', async () => {
      const txnResp: TransactionHistoryResponse = {
        data: [
          {
            id: 'txn-1',
            reference: 'ref-1',
            amount: '100.00',
            type: 'TRANSFER',
            direction: 'OUT',
            status: 'COMPLETED',
            description: 'Test transfer',
            createdAt: '2026-01-01T00:00:00.000Z',
            counterparty: '1234567890',
          },
        ],
        nextCursor: 'cursor-abc',
      }

      mockResponse = jsonResponse(200, txnResp)

      const result = await api.transactionHistory('acc-1')

      expect(result).toEqual(txnResp)
      expect(result.data).toHaveLength(1)
      expect(result.nextCursor).toBe('cursor-abc')
    })

    it('returns empty data and undefined cursor when body is null', async () => {
      mockResponse = emptyResponse(200)

      const result = await api.transactionHistory('acc-1')

      expect(result).toEqual({ data: [], nextCursor: undefined })
    })

    it('requests the correct endpoint with accountId and limit params', async () => {
      mockResponse = jsonResponse(200, { data: [], nextCursor: undefined })

      await api.transactionHistory('acc-1')

      expect(lastUrl).toContain('/transactions/history')
      expect(lastUrl).toContain('accountId=acc-1')
      expect(lastUrl).toContain('limit=8')
    })
  })

  // ---- transactionHistoryPage pagination ----------------------------------

  describe('transactionHistoryPage', () => {
    it('preserves pagination cursor in the request URL', async () => {
      mockResponse = jsonResponse(200, { data: [], nextCursor: 'cursor-next' })

      const result = await api.transactionHistoryPage('acc-1', { cursor: 'cursor-abc' })

      expect(lastUrl).toContain('cursor=cursor-abc')
      expect(result.nextCursor).toBe('cursor-next')
    })

    it('includes direction filter when provided', async () => {
      mockResponse = jsonResponse(200, { data: [], nextCursor: undefined })

      await api.transactionHistoryPage('acc-1', { direction: 'INCOMING' })

      expect(lastUrl).toContain('direction=INCOMING')
    })

    it('omits cursor and direction when not provided', async () => {
      mockResponse = jsonResponse(200, { data: [], nextCursor: undefined })

      await api.transactionHistoryPage('acc-1', {})

      expect(lastUrl).not.toContain('cursor=')
      expect(lastUrl).not.toContain('direction=')
    })

    it('uses PAGE_SIZE (10) as the limit param', async () => {
      mockResponse = jsonResponse(200, { data: [], nextCursor: undefined })

      await api.transactionHistoryPage('acc-1', {})

      expect(lastUrl).toContain('limit=10')
    })
  })

  // ---- Transfer requests --------------------------------------------------

  describe('transfer', () => {
    const transferPayload = {
      fromAccountId: 'acc-1',
      toAccountNumber: '0987654321',
      amount: '250.00',
      description: 'Rent',
      reference: 'ref-idempotent-123',
    }

    const transferResult: TransferResult = {
      id: 'txn-1',
      reference: 'ref-idempotent-123',
      amount: '250.00',
      type: 'TRANSFER',
      status: 'COMPLETED',
      description: 'Rent',
      fromAccountId: 'acc-1',
      toAccountId: 'acc-2',
      senderBalanceBefore: '5000.00',
      senderBalanceAfter: '4750.00',
      receiverBalanceBefore: '1000.00',
      receiverBalanceAfter: '1250.00',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    it('sends POST to /transactions/transfer', async () => {
      mockResponse = jsonResponse(200, envelope<TransferResult>(transferResult))

      await api.transfer(transferPayload)

      expect(lastUrl).toBe(`${BASE}/transactions/transfer`)
      expect(lastInit?.method).toBe('POST')
    })

    it('includes the idempotency reference in the request body', async () => {
      mockResponse = jsonResponse(200, envelope<TransferResult>(transferResult))

      await api.transfer(transferPayload)

      const body = JSON.parse(lastInit?.body as string)
      expect(body.reference).toBe('ref-idempotent-123')
      expect(body.fromAccountId).toBe('acc-1')
      expect(body.toAccountNumber).toBe('0987654321')
      expect(body.amount).toBe('250.00')
      expect(body.description).toBe('Rent')
    })

    it('returns the parsed TransferResult on success', async () => {
      mockResponse = jsonResponse(200, envelope<TransferResult>(transferResult))

      const result = await api.transfer(transferPayload)

      expect(result).toEqual(transferResult)
    })
  })

  // ---- Headers and credentials --------------------------------------------

  describe('request headers and credentials', () => {
    it('includes Content-Type, X-Device-Id, and X-Device-Name headers', async () => {
      mockResponse = jsonResponse(200, envelope<Account[]>([ACCOUNT_STUB]))

      await api.accounts()

      const headers = new Headers(lastInit?.headers as HeadersInit)
      expect(headers.get('Content-Type')).toBe('application/json')
      expect(headers.get('X-Device-Id')).toBeTruthy()
      expect(headers.get('X-Device-Name')).toBeTruthy()
    })

    it('includes credentials: include', async () => {
      mockResponse = jsonResponse(200, envelope<Account[]>([ACCOUNT_STUB]))

      await api.accounts()

      expect(lastInit?.credentials).toBe('include')
    })

    it('sets Authorization header when access token is present', async () => {
      authToken.set('my-access-token')
      mockResponse = jsonResponse(200, envelope<Account[]>([ACCOUNT_STUB]))

      await api.accounts()

      const headers = new Headers(lastInit?.headers as HeadersInit)
      expect(headers.get('Authorization')).toBe('Bearer my-access-token')
    })

    it('omits Authorization header when no access token is set', async () => {
      mockResponse = jsonResponse(200, envelope<Account[]>([ACCOUNT_STUB]))

      await api.accounts()

      const headers = new Headers(lastInit?.headers as HeadersInit)
      expect(headers.get('Authorization')).toBeNull()
    })

    it('persists a stable device ID across calls', async () => {
      mockResponse = jsonResponse(200, envelope<Account[]>([ACCOUNT_STUB]))

      await api.accounts()
      const firstHeaders = new Headers(lastInit?.headers as HeadersInit)
      const firstDeviceId = firstHeaders.get('X-Device-Id')

      await api.accounts()
      const secondHeaders = new Headers(lastInit?.headers as HeadersInit)
      const secondDeviceId = secondHeaders.get('X-Device-Id')

      expect(firstDeviceId).toBeTruthy()
      expect(secondDeviceId).toBe(firstDeviceId)
    })
  })

  // ---- refreshAccessToken direct behavior ---------------------------------

  describe('refreshAccessToken', () => {
    it('sets the new token and returns it on success', async () => {
      mockResponse = jsonResponse(200, envelope({ userId: 'user-1', accessToken: 'refreshed-token' }))

      const token = await refreshAccessToken()

      expect(token).toBe('refreshed-token')
    })

    it('returns null and clears token when refresh fails', async () => {
      authToken.set('old-token')
      mockResponse = jsonResponse(401, { success: false, error: 'Expired' })

      const token = await refreshAccessToken()

      expect(token).toBeNull()
    })
  })
})
