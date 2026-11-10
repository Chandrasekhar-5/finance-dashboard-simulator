import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Eye,
  EyeOff,
  Landmark,
  WalletCards,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useAuth } from '@/features/auth/AuthProvider'
import type { Account, Transaction } from '@/types/api'

const formatMoney = (amount: string | number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount))

const MASKED = '\u20B9 \u2022\u2022\u2022\u2022\u2022\u2022'

const statusVariant = (status: Account['status']): 'success' | 'warning' | 'error' =>
  status === 'ACTIVE' ? 'success' : status === 'INACTIVE' ? 'warning' : 'error'

export function DashboardPage() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [accountError, setAccountError] = useState('')
  const [txnError, setTxnError] = useState('')
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [loadingTxns, setLoadingTxns] = useState(false)
  const [showBalance, setShowBalance] = useState(true)

  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === selectedId) ?? accounts[0],
    [accounts, selectedId],
  )

  const totalBalance = useMemo(
    () => accounts.reduce((sum, a) => sum + Number(a.balance), 0),
    [accounts],
  )

  const activeCount = useMemo(
    () => accounts.filter(a => a.status === 'ACTIVE').length,
    [accounts],
  )

  useEffect(() => {
    api.accounts()
      .then(items => {
        const safe = Array.isArray(items) ? items : []
        setAccounts(safe)
        if (safe.length > 0) setSelectedId(safe[0].id)
      })
      .catch(cause => setAccountError(cause instanceof Error ? cause.message : 'Unable to load accounts'))
      .finally(() => setLoadingAccounts(false))
  }, [])

  useEffect(() => {
    if (!selectedAccount) {
      setTransactions([])
      return
    }
    setTxnError('')
    setLoadingTxns(true)
    api.transactionHistory(selectedAccount.id)
      .then(result => setTransactions(Array.isArray(result) ? result : []))
      .catch(cause => setTxnError(cause instanceof Error ? cause.message : 'Unable to load activity'))
      .finally(() => setLoadingTxns(false))
  }, [selectedAccount])

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  if (loadingAccounts) return <DashboardSkeleton />

  if (accountError) {
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        <ErrorState message={accountError} />
      </main>
    )
  }

  if (accounts.length === 0) {
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-blue-50 text-brand">
            <Landmark size={24} />
          </div>
          <h2 className="text-lg font-bold">No accounts yet</h2>
          <p className="text-sm text-muted">You don&apos;t have any accounts linked to your profile.</p>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back, {user?.firstName}</h1>
        <p className="mt-1 text-sm text-muted">{today}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-brand to-blue-800 p-6 text-white md:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-blue-100">Total balance</p>
              <p className="mt-2 text-3xl font-bold tracking-tight">
                {showBalance ? formatMoney(totalBalance, accounts[0]?.currency ?? 'INR') : MASKED}
              </p>
              <p className="mt-3 text-sm text-blue-100">
                Across {accounts.length} account{accounts.length > 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => setShowBalance(s => !s)}
              className="grid size-9 place-items-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
              aria-label={showBalance ? 'Hide balance' : 'Show balance'}
            >
              {showBalance ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-blue-50 text-brand">
              <WalletCards size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold">{accounts.length}</p>
              <p className="text-sm text-muted">Total accounts</p>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-sm text-muted">
              <span className="font-semibold text-emerald-600">{activeCount}</span> active
              {activeCount < accounts.length && (
                <span> &middot; {accounts.length - activeCount} other</span>
              )}
            </p>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-muted">Select account</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {accounts.map(a => (
            <button
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap rounded-lg border px-4 py-2.5 text-sm font-medium transition',
                a.id === selectedAccount?.id
                  ? 'border-brand bg-brand text-white'
                  : 'border-slate-200 bg-white text-muted hover:border-slate-300 hover:bg-slate-50',
              )}
            >
              <CreditCard
                size={16}
                className={a.id === selectedAccount?.id ? 'text-blue-100' : 'text-slate-400'}
              />
              {a.type} &bull;&bull;&bull;&bull; {a.accountNumber.slice(-4)}
            </button>
          ))}
        </div>
      </div>

      <Card className="mt-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h2 className="font-bold">Recent activity</h2>
            <p className="mt-1 text-sm text-muted">
              {selectedAccount?.type} &bull;&bull;&bull;&bull; {selectedAccount?.accountNumber.slice(-4)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={statusVariant(selectedAccount?.status ?? 'ACTIVE')}>
              {selectedAccount?.status}
            </Badge>
            <p className="text-sm font-semibold">
              {showBalance
                ? formatMoney(selectedAccount?.balance ?? '0', selectedAccount?.currency ?? 'INR')
                : MASKED}
            </p>
          </div>
        </div>

        {loadingTxns ? (
          <div className="p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-4">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : txnError ? (
          <div className="p-5">
            <ErrorState message={txnError} compact />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <div className="grid size-10 place-items-center rounded-full bg-slate-100 text-muted">
              <CreditCard size={20} />
            </div>
            <p className="text-sm text-muted">No transactions for this account yet.</p>
          </div>
        ) : (
          <ul>
            {transactions.map(item => (
              <li
                key={item.id}
                className="flex items-center gap-3 border-b border-slate-100 p-4 last:border-0 sm:px-5"
              >
                <span
                  className={cn(
                    'grid size-10 shrink-0 place-items-center rounded-full',
                    item.direction === 'IN' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600',
                  )}
                >
                  {item.direction === 'IN' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {item.description || item.counterparty || item.type}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(item.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    &middot; {item.status}
                  </p>
                </div>
                <p
                  className={cn(
                    'shrink-0 text-sm font-bold',
                    item.direction === 'IN' ? 'text-emerald-700' : 'text-ink',
                  )}
                >
                  {item.direction === 'IN' ? '+' : '\u2212'}
                  {showBalance ? formatMoney(item.amount, selectedAccount?.currency ?? 'INR') : '\u2022\u2022\u2022\u2022'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  )
}

function DashboardSkeleton() {
  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-36 md:col-span-2" />
        <Skeleton className="h-36" />
      </div>
      <div className="mt-6 flex gap-2">
        <Skeleton className="h-11 w-32" />
        <Skeleton className="h-11 w-32" />
        <Skeleton className="h-11 w-32" />
      </div>
      <Card className="mt-5 overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-slate-100 p-4 last:border-0 sm:px-5"
          >
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </Card>
    </main>
  )
}

function ErrorState({ message, compact }: { message: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg bg-red-50 text-sm text-red-700',
        compact ? 'p-3' : 'p-4',
      )}
    >
      <AlertCircle size={18} className="shrink-0" />
      <p>{message}</p>
    </div>
  )
}
