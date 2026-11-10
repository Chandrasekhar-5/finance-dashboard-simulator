import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, ArrowDownLeft, ArrowUpRight, CreditCard, Inbox, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { Account, Transaction } from '@/types/api'

const formatMoney = (amount: string | number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount))

type DirectionFilter = 'ALL' | 'INCOMING' | 'OUTGOING'

const FILTERS: { label: string; value: DirectionFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Incoming', value: 'INCOMING' },
  { label: 'Outgoing', value: 'OUTGOING' },
]

const statusClasses: Record<Transaction['status'], string> = {
  COMPLETED: 'bg-[#eceee3] text-[#4a5240]',
  PENDING: 'bg-[#f5ece3] text-[#8a6a3f]',
  FAILED: 'bg-[#f3e4de] text-[#8a3f25]',
  REVERSED: 'bg-[#e9e6dc] text-[#555b4f]',
}

export function ActivityPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [filter, setFilter] = useState<DirectionFilter>('ALL')

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const selectedAccount = accounts.find(a => a.id === selectedId) ?? accounts[0]

  const fetchPage = useCallback(
    async (accountId: string, direction: DirectionFilter, cursor?: string) => {
      const params: { cursor?: string; direction?: 'INCOMING' | 'OUTGOING' } = {}
      if (direction !== 'ALL') params.direction = direction
      if (cursor) params.cursor = cursor

      const result = await api.transactionHistoryPage(accountId, params)
      return result
    },
    [],
  )

  useEffect(() => {
    api
      .accounts()
      .then(items => {
        const safe = Array.isArray(items) ? items : []
        setAccounts(safe)
        if (safe.length > 0) setSelectedId(safe[0].id)
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Unable to load accounts'))
      .finally(() => setLoadingInitial(false))
  }, [])

  useEffect(() => {
    if (!selectedAccount) {
      setTransactions([])
      setNextCursor(undefined)
      return
    }

    setError('')
    setLoadingInitial(true)
    setTransactions([])
    setNextCursor(undefined)

    fetchPage(selectedAccount.id, filter)
      .then(result => {
        setTransactions(result.data)
        setNextCursor(result.nextCursor)
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Unable to load activity'))
      .finally(() => setLoadingInitial(false))
  }, [selectedAccount, filter, fetchPage])

  function loadMore() {
    if (!selectedAccount || !nextCursor || loadingMore) return
    setLoadingMore(true)
    fetchPage(selectedAccount.id, filter, nextCursor)
      .then(result => {
        setTransactions(prev => [...prev, ...result.data])
        setNextCursor(result.nextCursor)
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Unable to load more'))
      .finally(() => setLoadingMore(false))
  }

  function handleAccountChange(id: string) {
    setSelectedId(id)
  }

  function handleFilterChange(value: DirectionFilter) {
    setFilter(value)
  }

  if (loadingInitial && accounts.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-11">
        <div className="mb-7">
          <Skeleton className="h-3 w-24 bg-[#eeebe2]" />
          <Skeleton className="mt-2 h-7 w-48 bg-[#eeebe2]" />
        </div>
        <Skeleton className="mb-5 h-14 bg-[#eeebe2]" />
        <Card className="border-[#e7e3d9] bg-[#fbfaf6]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-[#e7e3d9] p-4 last:border-0 sm:px-5"
            >
              <Skeleton className="size-10 shrink-0 rounded-full bg-[#eeebe2]" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-44 bg-[#eeebe2]" />
                <Skeleton className="h-3 w-28 bg-[#eeebe2]" />
              </div>
              <Skeleton className="h-4 w-24 bg-[#eeebe2]" />
            </div>
          ))}
        </Card>
      </main>
    )
  }

  if (error && accounts.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-11">
        <div className="mb-7">
          <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#9a9b91]">Activity</p>
          <h1 className="mt-1.5 font-display text-[28px] font-extrabold tracking-[-.04em] text-[#252923]">
            Transaction history
          </h1>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-[#f3e4de] p-4 text-[13px] font-medium text-[#8a3f25]">
          <AlertCircle size={18} className="shrink-0" />
          <p>{error}</p>
        </div>
      </main>
    )
  }

  if (accounts.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-11">
        <div className="mb-7">
          <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#9a9b91]">Activity</p>
          <h1 className="mt-1.5 font-display text-[28px] font-extrabold tracking-[-.04em] text-[#252923]">
            Transaction history
          </h1>
        </div>
        <Card className="flex flex-col items-center gap-3 border-[#e7e3d9] bg-[#fbfaf6] p-10 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-[#f1eee5] text-[#77796f]">
            <CreditCard size={24} />
          </div>
          <p className="text-[14px] text-[#77796f]">You don&apos;t have any accounts yet.</p>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-11">
      <div className="mb-7">
        <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#9a9b91]">Activity</p>
        <h1 className="mt-1.5 font-display text-[28px] font-extrabold tracking-[-.04em] text-[#252923]">
          Transaction history
        </h1>
      </div>

      {accounts.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {accounts.map(a => (
            <button
              key={a.id}
              onClick={() => handleAccountChange(a.id)}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition',
                a.id === selectedAccount?.id
                  ? 'border-[#252923] bg-[#252923] text-[#f8f6f0]'
                  : 'border-[#e0dccf] bg-[#fbfaf6] text-[#77796f] hover:border-[#cdc8bb] hover:bg-[#f1eee5]',
              )}
            >
              {a.type} &bull;&bull;&bull;&bull; {a.accountNumber.slice(-4)}
            </button>
          ))}
        </div>
      )}

      <div className="mb-5 flex gap-2">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => handleFilterChange(f.value)}
            className={cn(
              'rounded-lg px-4 py-2 text-[13px] font-semibold transition',
              filter === f.value
                ? 'bg-[#e9e6dc] text-[#252923]'
                : 'text-[#77796f] hover:bg-[#efede5] hover:text-[#252923]',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && transactions.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-[#f3e4de] p-4 text-[13px] font-medium text-[#8a3f25]">
          <AlertCircle size={18} className="shrink-0" />
          <p>{error}</p>
        </div>
      ) : loadingInitial ? (
        <Card className="border-[#e7e3d9] bg-[#fbfaf6]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-[#e7e3d9] p-4 last:border-0 sm:px-5"
            >
              <Skeleton className="size-10 shrink-0 rounded-full bg-[#eeebe2]" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-44 bg-[#eeebe2]" />
                <Skeleton className="h-3 w-28 bg-[#eeebe2]" />
              </div>
              <Skeleton className="h-4 w-24 bg-[#eeebe2]" />
            </div>
          ))}
        </Card>
      ) : transactions.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 border-[#e7e3d9] bg-[#fbfaf6] p-10 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-[#f1eee5] text-[#77796f]">
            <Inbox size={24} />
          </div>
          <p className="text-[14px] text-[#77796f]">
            No {filter !== 'ALL' ? filter.toLowerCase() : ''} transactions for this account yet.
          </p>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden border-[#e7e3d9] bg-[#fbfaf6]">
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
                    <p className="mt-0.5 text-[12px] text-[#77796f]">
                      {new Date(item.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {' at '}
                      {new Date(item.createdAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={cn(
                        'hidden rounded-full px-2.5 py-0.5 text-[11px] font-semibold sm:inline-flex',
                        statusClasses[item.status],
                      )}
                    >
                      {item.status}
                    </span>
                    <p
                      className={cn(
                        'text-[14px] font-bold',
                        item.direction === 'IN' ? 'text-[#4a5240]' : 'text-[#252923]',
                      )}
                    >
                      {item.direction === 'IN' ? '+' : '\u2212'}
                      {formatMoney(item.amount, selectedAccount?.currency ?? 'INR')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {nextCursor && (
            <div className="mt-5 flex justify-center">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
                className="min-w-36"
              >
                {loadingMore ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Loading…
                  </>
                ) : (
                  'Load more'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  )
}
