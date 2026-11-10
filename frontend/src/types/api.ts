export interface ApiEnvelope<T> { success: boolean; data: T; message?: string }
export interface User { id: string; email: string; firstName: string; lastName: string }
export interface TokenPayload { userId: string; accessToken: string }
export interface Account { id: string; accountNumber: string; type: 'CHECKING' | 'SAVINGS' | 'CREDIT'; status: 'ACTIVE' | 'INACTIVE' | 'CLOSED'; balance: string; currency: string; createdAt: string; updatedAt: string }
export interface Transaction { id: string; reference: string; amount: string; type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER'; direction: 'IN' | 'OUT'; status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED'; description: string | null; createdAt: string; counterparty: string }
export interface TransactionHistoryResponse { data: Transaction[]; nextCursor?: string }
export interface TransferResult {
  id: string
  reference: string
  amount: string
  type: 'TRANSFER'
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED'
  description: string | null
  fromAccountId: string
  toAccountId: string
  senderBalanceBefore: string | null
  senderBalanceAfter: string | null
  receiverBalanceBefore: string | null
  receiverBalanceAfter: string | null
  createdAt: string
  updatedAt: string
}
export interface TransferRequest {
  fromAccountId: string
  toAccountNumber: string
  amount: string
  description?: string
  reference: string
}
export interface ApiErrorBody { success: false; error?: string; message?: string }
