import type {
  Account,
  ApiEnvelope,
  ApiErrorBody,
  Session,
  TokenPayload,
  User,
  Transaction,
  TransactionHistoryResponse,
  TransferRequest,
  TransferResult
} from '@/types/api'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api/v1'
let accessToken: string | null = null
let refreshPromise: Promise<string | null> | null = null
export class ApiError extends Error { readonly status: number; constructor(message: string, status: number) { super(message); this.status = status } }
export const authToken = { set: (token: string | null) => { accessToken = token } }
function getDeviceId() { const key = 'banking-device-id'; let id = localStorage.getItem(key); if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id) }; return id }
async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> { const headers = new Headers(init.headers); headers.set('Content-Type', 'application/json'); headers.set('X-Device-Id', getDeviceId()); headers.set('X-Device-Name', navigator.userAgent.slice(0, 100)); if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`); const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers, credentials: 'include' }); if (response.status === 401 && retry && path !== '/auth/refresh') { const token = await refreshAccessToken(); if (token) return request<T>(path, init, false) }; const body = await response.json().catch(() => null) as ApiEnvelope<T> | ApiErrorBody | null; if (!response.ok) throw new ApiError((body && ('error' in body ? body.error : body.message)) || 'Request failed', response.status); return (body as ApiEnvelope<T>).data }
export function refreshAccessToken() { if (!refreshPromise) refreshPromise = request<TokenPayload>('/auth/refresh', { method: 'POST' }, false).then(data => { authToken.set(data.accessToken); return data.accessToken }).catch(() => { authToken.set(null); return null }).finally(() => { refreshPromise = null }); return refreshPromise }

const PAGE_SIZE = 10

export const api = {
  login: (email: string, password: string) => request<TokenPayload>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (firstName: string, lastName: string, email: string, password: string) => request<TokenPayload>('/auth/register', { method: 'POST', body: JSON.stringify({ firstName, lastName, email, password }) }),
  logout: () => request<unknown>('/auth/logout', { method: 'POST' }),
  me: () => request<User>('/auth/me'),
  exchangeOAuthTicket: (ticket: string) => request<TokenPayload>('/auth/oauth/exchange', { method: 'POST', body: JSON.stringify({ ticket }) }),
  accounts: () => request<Account[]>('/accounts'),
  account: (accountId: string) => request<Account>(`/accounts/${accountId}`),
  transactionHistory: (accountId: string) => request<Transaction[]>(`/transactions/history?${new URLSearchParams({ accountId, limit: '8' })}`),
  transactionHistoryPage: (accountId: string, params: { cursor?: string; direction?: 'INCOMING' | 'OUTGOING' }) => {
    const sp = new URLSearchParams({ accountId, limit: String(PAGE_SIZE) })
    if (params.cursor) sp.set('cursor', params.cursor)
    if (params.direction) sp.set('direction', params.direction)
    return request<TransactionHistoryResponse>(`/transactions/history?${sp}`)
  },
  transfer: (payload: TransferRequest) =>
    request<TransferResult>('/transactions/transfer', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  sessions: () => request<Session[]>('/auth/sessions'),
  revokeSession: (sessionId: string) =>
    request<unknown>(`/auth/sessions/${sessionId}`, { method: 'DELETE' }),
  logoutAll: () => request<unknown>('/auth/logout-all', { method: 'POST' }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<unknown>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  forgotPassword: (email: string) =>
    request<unknown>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, newPassword: string) =>
    request<unknown>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),
  resendVerification: (email: string) =>
    request<unknown>('/auth/verify-email/resend', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
}
