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
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useAuth } from '@/features/auth/AuthProvider'
import type { Account, Transaction } from '@/types/api'

const formatMoney = (amount: string | number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount))

const MASKED = '\u20B9 \u2022\u2022\u2022\u2022\u2022\u2022'

const statusLabel = (status: Account['status']) =>
  status === 'ACTIVE' ? 'Active' : status === 'INACTIVE' ? 'Inactive' : 'Closed'

const statusClasses: Record<Account['status'], string> = {
  ACTIVE: 'bg-[#eceee3] text-[#4a5240]',
  INACTIVE: 'bg-[#f5ece3] text-[#8a6a3f]',
  CLOSED: 'bg-[#f3e4de] text-[#8a3f25]',
}

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
    api
      .accounts()
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
    api
      .transactionHistory(selectedAccount.id)
      .then(result => setTransactions(Array.isArray(result) ? result : []))
      .catch(cause => setTxnError(cause instanceof Error ? cause.message : 'Unable to load activity'))
      .finally(() => setLoadingTxns(false))
  }, [selectedAccount])

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  if (loadingAccounts) return <DashboardSkeleton />

  if (accountError) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-11">
        <ErrorState message={accountError} />
      </main>
    )
  }

  if (accounts.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-11">
        <Card className="flex flex-col items-center gap-3 border-[#e7e3d9] bg-[#fbfaf6] p-10 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-[#f1eee5] text-[#a7654b]">
            <Landmark size={24} />
          </div>
          <h2 className="font-display text-lg font-extrabold tracking-[-.03em] text-[#252923]">No accounts yet</h2>
          <p className="text-[14px] text-[#77796f]">You don&apos;t have any accounts linked to your profile.</p>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-11">
      <div className="mb-7">
        <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#9a9b91]">{today}</p>
        <h1 className="mt-1.5 font-display text-[28px] font-extrabold tracking-[-.04em] text-[#252923]">
          Welcome back, {user?.firstName}
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-[#252923] p-6 text-[#f8f6f0] md:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[13px] text-[#b8bcb1]">Total balance</p>
              <p className="mt-2 font-display text-[34px] font-extrabold tracking-[-.04em]">
                {showBalance ? formatMoney(totalBalance, accounts[0]?.currency ?? 'INR') : MASKED}
              </p>
              <p className="mt-3 text-[13px] text-[#8b8e83]">
                Across {accounts.length} account{accounts.length > 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => setShowBalance(s => !s)}
              className="grid size-9 place-items-center rounded-xl bg-[#f8f6f0]/10 text-[#f8f6f0] transition hover:bg-[#f8f6f0]/20"
              aria-label={showBalance ? 'Hide balance' : 'Show balance'}
            >
              {showBalance ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
        </Card>

        <Card className="border-[#e7e3d9] bg-[#fbfaf6] p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-[#f1eee5] text-[#a7654b]">
              <WalletCards size={20} />
            </div>
            <div>
              <p className="font-display text-2xl font-extrabold tracking-[-.03em] text-[#252923]">{accounts.length}</p>
              <p className="text-[13px] text-[#77796f]">Total accounts</p>
            </div>
          </div>
          <div className="mt-4 border-t border-[#e7e3d9] pt-4">
            <p className="text-[13px] text-[#77796f]">
              <span className="font-semibold text-[#4a5240]">{activeCount}</span> active
              {activeCount < accounts.length && (
                <span> &middot; {accounts.length - activeCount} other</span>
              )}
            </p>
          </div>
        </Card>
      </div>

      <div className="mt-7">
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[.18em] text-[#9a9b91]">Select account</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {accounts.map(a => (
            <button
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition',
                a.id === selectedAccount?.id
                  ? 'border-[#252923] bg-[#252923] text-[#f8f6f0]'
                  : 'border-[#e0dccf] bg-[#fbfaf6] text-[#77796f] hover:border-[#cdc8bb] hover:bg-[#f1eee5]',
              )}
            >
              <CreditCard
                size={16}
                className={a.id === selectedAccount?.id ? 'text-[#b8bcb1]' : 'text-[#b8bcb1]'}
              />
              {a.type} &bull;&bull;&bull;&bull; {a.accountNumber.slice(-4)}
            </button>
          ))}
        </div>
      </div>

      <Card className="mt-5 overflow-hidden border-[#e7e3d9] bg-[#fbfaf6]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7e3d9] p-5">
          <div>
            <h2 className="font-display text-[17px] font-extrabold tracking-[-.03em] text-[#252923]">Recent activity</h2>
            <p className="mt-1 text-[13px] text-[#77796f]">
              {selectedAccount?.type} &bull;&bull;&bull;&bull; {selectedAccount?.accountNumber.slice(-4)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                statusClasses[selectedAccount?.status ?? 'ACTIVE'],
              )}
            >
              {statusLabel(selectedAccount?.status ?? 'ACTIVE')}
            </span>
            <p className="font-display text-[15px] font-bold text-[#252923]">
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
                <Skeleton className="size-10 shrink-0 rounded-full bg-[#eeebe2]" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40 bg-[#eeebe2]" />
                  <Skeleton className="h-3 w-24 bg-[#eeebe2]" />
                </div>
                <Skeleton className="h-4 w-20 bg-[#eeebe2]" />
              </div>
            ))}
          </div>
        ) : txnError ? (
          <div className="p-5">
            <ErrorState message={txnError} compact />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <div className="grid size-10 place-items-center rounded-full bg-[#f1eee5] text-[#77796f]">
              <CreditCard size={20} />
            </div>
            <p className="text-[14px] text-[#77796f]">No transactions for this account yet.</p>
          </div>
        ) : (
          <ul>
            {transactions.map(item => (
              <li
                key={item.id}
                className="flex items-center gap-3 border-b border-[#e7e3d9] p-4 last:border-0 sm:px-5"
              >
                <span
                  className={cn(
                    'grid size-10 shrink-0 place-items-center rounded-full',
                    item.direction === 'IN' ? 'bg-[#eceee3] text-[#4a5240]' : 'bg-[#f3e4de] text-[#8a3f25]',
                  )}
                >
                  {item.direction === 'IN' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-[#252923]">
                    {item.description || item.counterparty || item.type}
                  </p>
                  <p className="text-[12px] text-[#77796f]">
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
                    'shrink-0 text-[14px] font-bold',
                    item.direction === 'IN' ? 'text-[#4a5240]' : 'text-[#252923]',
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
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-11">
      <div className="mb-7 space-y-2">
        <Skeleton className="h-3 w-32 bg-[#eeebe2]" />
        <Skeleton className="h-8 w-64 bg-[#eeebe2]" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-36 bg-[#eeebe2] md:col-span-2" />
        <Skeleton className="h-36 bg-[#eeebe2]" />
      </div>
      <div className="mt-7 flex gap-2">
        <Skeleton className="h-11 w-32 bg-[#eeebe2]" />
        <Skeleton className="h-11 w-32 bg-[#eeebe2]" />
        <Skeleton className="h-11 w-32 bg-[#eeebe2]" />
      </div>
      <Card className="mt-5 overflow-hidden border-[#e7e3d9] bg-[#fbfaf6]">
        <div className="border-b border-[#e7e3d9] p-5">
          <Skeleton className="h-5 w-32 bg-[#eeebe2]" />
          <Skeleton className="mt-2 h-4 w-48 bg-[#eeebe2]" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-[#e7e3d9] p-4 last:border-0 sm:px-5"
          >
            <Skeleton className="size-10 shrink-0 rounded-full bg-[#eeebe2]" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40 bg-[#eeebe2]" />
              <Skeleton className="h-3 w-24 bg-[#eeebe2]" />
            </div>
            <Skeleton className="h-4 w-20 bg-[#eeebe2]" />
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
        'flex items-center gap-3 rounded-xl bg-[#f3e4de] text-[13px] font-medium text-[#8a3f25]',
        compact ? 'px-4 py-3' : 'p-4',
      )}
    >
      <AlertCircle size={18} className="shrink-0" />
      <p>{message}</p>
    </div>
  )
}
