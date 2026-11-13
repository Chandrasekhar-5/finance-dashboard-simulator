import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  Landmark,
  PauseCircle,
  XCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { Account } from '@/types/api'

const formatMoney = (amount: string | number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount))

const ACCOUNT_TYPE_LABEL: Record<Account['type'], string> = {
  CHECKING: 'Checking',
  SAVINGS: 'Savings',
  CREDIT: 'Credit',
}

function maskAccountNumber(num: string): string {
  if (num.length <= 4) return num
  return `\u2022\u2022\u2022\u2022\u2022\u2022${num.slice(-4)}`
}

const STATUS_META: Record<
  Account['status'],
  { label: string; classes: string; icon: typeof CheckCircle2 }
> = {
  ACTIVE: { label: 'Active', classes: 'bg-[#eceee3] text-[#4a5240]', icon: CheckCircle2 },
  INACTIVE: { label: 'Inactive', classes: 'bg-[#f5ece3] text-[#8a6a3f]', icon: PauseCircle },
  CLOSED: { label: 'Closed', classes: 'bg-[#f3e4de] text-[#8a3f25]', icon: XCircle },
}

export function AccountsPage() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showBalances, setShowBalances] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<Account | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  const loadAccounts = useCallback(async () => {
    const items = await api.accounts()
    setAccounts(Array.isArray(items) ? items : [])
    return items
  }, [])

  useEffect(() => {
    loadAccounts()
      .then(items => {
        const safe = Array.isArray(items) ? items : []
        if (safe.length > 0) setSelectedId(safe[0].id)
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Unable to load accounts'))
      .finally(() => setLoading(false))
  }, [loadAccounts])

  // Fetch the selected account's details from the single-account endpoint.
  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    setDetailError('')
    setDetailLoading(true)
    api
      .account(selectedId)
      .then(data => setDetail(data))
      .catch(cause => setDetailError(cause instanceof Error ? cause.message : 'Unable to load account details'))
      .finally(() => setDetailLoading(false))
  }, [selectedId])

  // Group active balances by currency so different currencies are never
  // added together into one misleading total.
  const totalsByCurrency = useMemo(() => {
    const groups = new Map<string, number>()
    for (const a of accounts) {
      if (a.status !== 'ACTIVE') continue
      groups.set(a.currency, (groups.get(a.currency) ?? 0) + Number(a.balance))
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [accounts])

  const activeCount = useMemo(() => accounts.filter(a => a.status === 'ACTIVE').length, [accounts])
  const inactiveCount = useMemo(() => accounts.filter(a => a.status === 'INACTIVE').length, [accounts])
  const closedCount = useMemo(() => accounts.filter(a => a.status === 'CLOSED').length, [accounts])

  if (loading) return <AccountsSkeleton />

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-11">
        <PageHeader />
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
        <PageHeader />
        <Card className="flex flex-col items-center gap-3 border-[#e7e3d9] bg-[#fbfaf6] p-10 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-[#f1eee5] text-[#77796f]">
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
      <div className="mb-7 flex items-start justify-between gap-4">
        <PageHeader />
        <button
          onClick={() => setShowBalances(s => !s)}
          className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#e0dccf] bg-[#fbfaf6] text-[#555b4f] transition hover:bg-[#f1eee5]"
          aria-label={showBalances ? 'Hide balances' : 'Show balances'}
        >
          {showBalances ? <Eye size={17} /> : <EyeOff size={17} />}
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-[#252923] p-6 text-[#f8f6f0] md:col-span-2">
          <p className="text-[13px] text-[#b8bcb1]">Total balance (active)</p>
          {totalsByCurrency.length === 0 ? (
            <p className="mt-2 font-display text-[32px] font-extrabold tracking-[-.04em]">{showBalances ? formatMoney(0, 'INR') : '\u2022\u2022\u2022\u2022\u2022\u2022'}</p>
          ) : (
            <div className="mt-2 space-y-1.5">
              {totalsByCurrency.map(([currency, total]) => (
                <p key={currency} className="font-display text-[32px] font-extrabold leading-tight tracking-[-.04em]">
                  {showBalances ? formatMoney(total, currency) : '\u2022\u2022\u2022\u2022\u2022\u2022'}
                  {totalsByCurrency.length > 1 && <span className="ml-2 text-[14px] font-semibold text-[#b8bcb1]">{currency}</span>}
                </p>
              ))}
            </div>
          )}
          <p className="mt-3 text-[13px] text-[#8b8e83]">
            Across {activeCount} active account{activeCount !== 1 ? 's' : ''}
          </p>
        </Card>
        <Card className="border-[#e7e3d9] bg-[#fbfaf6] p-6">
          <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#9a9b91]">Breakdown</p>
          <div className="mt-3 space-y-2.5">
            <StatusCount label="Active" count={activeCount} classes="text-[#4a5240]" />
            {inactiveCount > 0 && <StatusCount label="Inactive" count={inactiveCount} classes="text-[#8a6a3f]" />}
            {closedCount > 0 && <StatusCount label="Closed" count={closedCount} classes="text-[#8a3f25]" />}
          </div>
        </Card>
      </div>

      {/* Account list + detail */}
      <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[.18em] text-[#9a9b91]">Your accounts</h2>
          <ul className="space-y-3">
            {accounts.map(a => {
              const meta = STATUS_META[a.status]
              const selected = a.id === selectedId
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(a.id)}
                    className={cn(
                      'flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition',
                      selected
                        ? 'border-[#252923] bg-[#fbfaf6] shadow-[0_1px_3px_rgba(37,41,35,.06)]'
                        : 'border-[#e7e3d9] bg-[#fbfaf6] hover:border-[#cdc8bb] hover:bg-[#f5f3ec]',
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-11 shrink-0 place-items-center rounded-xl',
                        a.status === 'ACTIVE' ? 'bg-[#eceee3] text-[#4a5240]' : 'bg-[#f1eee5] text-[#77796f]',
                      )}
                    >
                      <CreditCard size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[14px] font-bold text-[#252923]">{ACCOUNT_TYPE_LABEL[a.type]}</p>
                        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', meta.classes)}>
                          <meta.icon size={11} /> {meta.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12px] text-[#77796f]">{maskAccountNumber(a.accountNumber)}</p>
                    </div>
                    <p className="shrink-0 text-right font-display text-[15px] font-extrabold tracking-[-.02em] text-[#252923]">
                      {showBalances ? formatMoney(a.balance, a.currency) : '\u2022\u2022\u2022\u2022'}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Detail panel */}
        <div>
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[.18em] text-[#9a9b91]">Account details</h2>
          {detailLoading ? (
            <Card className="border-[#e7e3d9] bg-[#fbfaf6] p-6">
              <Skeleton className="h-5 w-32 bg-[#eeebe2]" />
              <Skeleton className="mt-4 h-9 w-40 bg-[#eeebe2]" />
              <div className="mt-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 bg-[#eeebe2]" />
                ))}
              </div>
            </Card>
          ) : detailError ? (
            <Card className="flex items-center gap-3 border-[#e7e3d9] bg-[#fbfaf6] p-5">
              <AlertCircle size={18} className="shrink-0 text-[#8a3f25]" />
              <p className="text-[13px] font-medium text-[#8a3f25]">{detailError}</p>
            </Card>
          ) : detail ? (
            <AccountDetail account={detail} showBalance={showBalances} onTransfer={() => navigate(`/transfer?from=${detail.id}`)} />
          ) : (
            <Card className="flex flex-col items-center gap-2 border-[#e7e3d9] bg-[#fbfaf6] p-10 text-center">
              <div className="grid size-10 place-items-center rounded-full bg-[#f1eee5] text-[#77796f]">
                <CreditCard size={20} />
              </div>
              <p className="text-[14px] text-[#77796f]">Select an account to view details.</p>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}

function AccountDetail({ account, showBalance, onTransfer }: { account: Account; showBalance: boolean; onTransfer: () => void }) {
  const meta = STATUS_META[account.status]
  const isActive = account.status === 'ACTIVE'
  const [revealNumber, setRevealNumber] = useState(false)

  return (
    <Card className="border-[#e7e3d9] bg-[#fbfaf6] p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'grid size-12 place-items-center rounded-xl',
              isActive ? 'bg-[#eceee3] text-[#4a5240]' : 'bg-[#f1eee5] text-[#77796f]',
            )}
          >
            <CreditCard size={22} />
          </span>
          <div>
            <h3 className="font-display text-[18px] font-extrabold tracking-[-.03em] text-[#252923]">
              {ACCOUNT_TYPE_LABEL[account.type]}
            </h3>
            <p className="mt-0.5 text-[12px] text-[#77796f]">{maskAccountNumber(account.accountNumber)}</p>
          </div>
        </div>
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold', meta.classes)}>
          <meta.icon size={12} /> {meta.label}
        </span>
      </div>

      <div className="mt-5 rounded-xl border border-[#e7e3d9] bg-[#f1eee5] px-4 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9a9b91]">Available balance</p>
        <p className="mt-1 font-display text-[26px] font-extrabold tracking-[-.03em] text-[#252923]">
          {showBalance ? formatMoney(account.balance, account.currency) : '\u2022\u2022\u2022\u2022\u2022\u2022'}
        </p>
      </div>

      <dl className="mt-5 space-y-1">
        <div className="flex items-center justify-between gap-4 border-b border-[#eeebe2] py-3">
          <dt className="text-[13px] text-[#77796f]">Account number</dt>
          <dd className="flex items-center gap-2 text-right">
            <span className="font-mono text-[13px] font-semibold text-[#252923]">
              {revealNumber ? account.accountNumber : maskAccountNumber(account.accountNumber)}
            </span>
            <button
              type="button"
              onClick={() => setRevealNumber(r => !r)}
              className="grid size-7 place-items-center rounded-lg text-[#77796f] transition hover:bg-[#eeebe2]"
              aria-label={revealNumber ? 'Hide account number' : 'Show account number'}
            >
              {revealNumber ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </dd>
        </div>
        <DetailRow label="Currency" value={account.currency} />
        <DetailRow label="Type" value={ACCOUNT_TYPE_LABEL[account.type]} />
        <DetailRow label="Status" value={meta.label} />
        <DetailRow
          label="Opened"
          value={new Date(account.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        />
        <DetailRow
          label="Last updated"
          value={new Date(account.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        />
      </dl>

      {isActive && (
        <Button variant="terracotta" onClick={onTransfer} className="mt-6 w-full">
          <ArrowUpRight size={16} /> Transfer from this account
        </Button>
      )}
    </Card>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#eeebe2] py-3 last:border-0">
      <dt className="text-[13px] text-[#77796f]">{label}</dt>
      <dd className="text-right text-[13px] font-semibold text-[#252923]">{value}</dd>
    </div>
  )
}

function StatusCount({ label, count, classes }: { label: string; count: number; classes: string }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-[#77796f]">{label}</span>
      <span className={cn('font-bold', classes)}>{count}</span>
    </div>
  )
}

function PageHeader() {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#9a9b91]">Accounts</p>
      <h1 className="mt-1.5 font-display text-[28px] font-extrabold tracking-[-.04em] text-[#252923]">Your accounts</h1>
    </div>
  )
}

function AccountsSkeleton() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-11">
      <div className="mb-7 space-y-2">
        <Skeleton className="h-3 w-24 bg-[#eeebe2]" />
        <Skeleton className="mt-2 h-7 w-48 bg-[#eeebe2]" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-32 bg-[#eeebe2] md:col-span-2" />
        <Skeleton className="h-32 bg-[#eeebe2]" />
      </div>
      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] bg-[#eeebe2]" />
          ))}
        </div>
        <Skeleton className="h-80 bg-[#eeebe2]" />
      </div>
    </main>
  )
}
