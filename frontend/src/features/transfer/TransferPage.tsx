import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle2,
  CreditCard,
  Loader2,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { api, ApiError } from '@/lib/api'
import type { Account, TransferResult } from '@/types/api'

const formatMoney = (amount: string | number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount))

type Stage = 'form' | 'confirm' | 'submitting' | 'success' | 'error'

interface FormState {
  fromAccountId: string
  toAccountNumber: string
  amount: string
  description: string
}

const EMPTY_FORM: FormState = {
  fromAccountId: '',
  toAccountNumber: '',
  amount: '',
  description: '',
}

function maskAccountNumber(num: string): string {
  if (num.length <= 4) return num
  return `\u2022\u2022\u2022\u2022\u2022\u2022${num.slice(-4)}`
}

function friendlyError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return 'This transfer was already submitted. Check your activity before trying again.'
    if (err.status === 403 && /verification/i.test(err.message)) return 'Email verification is required to make transfers.'
    return err.message
  }
  if (err instanceof Error) return err.message
  return 'Transfer failed. Please try again.'
}

export function TransferPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [accountError, setAccountError] = useState('')

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [stage, setStage] = useState<Stage>('form')
  const [submitError, setSubmitError] = useState('')
  const [result, setResult] = useState<TransferResult | null>(null)

  // Idempotency: one reference per logical transfer, reused across retries.
  const referenceRef = useRef<string>(crypto.randomUUID())
  const lastSubmittedRef = useRef<FormState | null>(null)
  // Guard against a double click / re-entry between user action and stage flip.
  const submittingRef = useRef(false)

  const loadAccounts = useCallback(async () => {
    const items = await api.accounts()
    setAccounts(Array.isArray(items) ? items : [])
    return items
  }, [])

  useEffect(() => {
    const fromParam = searchParams.get('from')
    loadAccounts()
      .then(items => {
        const safe = Array.isArray(items) ? items : []
        const active = safe.filter(a => a.status === 'ACTIVE')
        // Preselect the account from the query param only if it belongs to
        // this user and is active — the backend remains authoritative.
        const paramMatch = fromParam ? active.find(a => a.id === fromParam) : undefined
        if (paramMatch) {
          setForm(f => ({ ...f, fromAccountId: paramMatch.id }))
        } else if (active.length > 0) {
          setForm(f => ({ ...f, fromAccountId: active[0].id }))
        }
      })
      .catch(cause => setAccountError(cause instanceof Error ? cause.message : 'Unable to load accounts'))
      .finally(() => setLoadingAccounts(false))
  }, [loadAccounts, searchParams])

  const activeAccounts = useMemo(() => accounts.filter(a => a.status === 'ACTIVE'), [accounts])

  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === form.fromAccountId),
    [accounts, form.fromAccountId],
  )

  const balance = selectedAccount ? Number(selectedAccount.balance) : 0
  const currency = selectedAccount?.currency ?? 'INR'

  // --- Validation -------------------------------------------------------
  const errors = useMemo(() => {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (!form.fromAccountId) e.fromAccountId = 'Select an account to send from.'
    if (!form.toAccountNumber) {
      e.toAccountNumber = 'Enter the recipient account number.'
    } else if (!/^\d{10}$/.test(form.toAccountNumber)) {
      e.toAccountNumber = 'Account number must be exactly 10 digits.'
    } else if (selectedAccount && form.toAccountNumber === selectedAccount.accountNumber) {
      e.toAccountNumber = 'You cannot transfer to your own account.'
    }
    const amt = Number(form.amount)
    if (!form.amount) {
      e.amount = 'Enter an amount.'
    } else if (Number.isNaN(amt) || amt <= 0) {
      e.amount = 'Amount must be greater than zero.'
    } else if (!/^\d+(\.\d{1,4})?$/.test(form.amount)) {
      e.amount = 'Use up to 4 decimal places.'
    } else if (amt > balance) {
      e.amount = 'Amount exceeds available balance.'
    }
    if (form.description.length > 255) e.description = 'Description must be 255 characters or fewer.'
    return e
  }, [form, selectedAccount, balance])

  const isValid = Object.keys(errors).length === 0

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      // Changing the logical transfer invalidates the previous reference,
      // unless we are mid-submission (reference must stay stable for retries).
      if (!submittingRef.current && lastSubmittedRef.current && !shallowEqual(lastSubmittedRef.current, next)) {
        referenceRef.current = crypto.randomUUID()
      }
      return next
    })
  }

  function shallowEqual(a: FormState, b: FormState): boolean {
    return (
      a.fromAccountId === b.fromAccountId &&
      a.toAccountNumber === b.toAccountNumber &&
      a.amount === b.amount &&
      a.description === b.description
    )
  }

  function handleBlur(key: keyof FormState) {
    setTouched(t => ({ ...t, [key]: true }))
  }

  function resetForNewTransfer() {
    referenceRef.current = crypto.randomUUID()
    lastSubmittedRef.current = null
    submittingRef.current = false
    setForm(EMPTY_FORM)
    setTouched({})
    setSubmitError('')
    setResult(null)
    setStage('form')
    if (activeAccounts.length > 0) {
      setForm(f => ({ ...f, fromAccountId: activeAccounts[0].id }))
    }
  }

  function proceedToConfirm() {
    setTouched({ fromAccountId: true, toAccountNumber: true, amount: true, description: true })
    if (!isValid) return
    setSubmitError('')
    setStage('confirm')
  }

  async function executeTransfer() {
    if (submittingRef.current) return
    submittingRef.current = true
    setStage('submitting')
    setSubmitError('')
    // Freeze the form snapshot that this reference belongs to.
    lastSubmittedRef.current = { ...form }

    try {
      const payload = {
        fromAccountId: form.fromAccountId,
        toAccountNumber: form.toAccountNumber,
        amount: form.amount,
        description: form.description.trim() || undefined,
        reference: referenceRef.current,
      }
      const data = await api.transfer(payload)
      setResult(data)
      setStage('success')
      // Refresh account balances so the UI reflects the debit. Best-effort —
      // the receipt is already confirmed by the backend response above.
      loadAccounts().catch(() => {})
    } catch (err) {
      const message = friendlyError(err)
      setSubmitError(message)
      // 409 means the backend already accepted this reference — treat as resolved,
      // do not allow a silent re-submit with the same reference.
      if (err instanceof ApiError && err.status === 409) {
        setStage('error')
      } else {
        // Network/business failure: keep the same reference so a retry is idempotent.
        setStage('confirm')
      }
    } finally {
      submittingRef.current = false
    }
  }

  // --- Loading / error shells ------------------------------------------
  if (loadingAccounts) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-8 sm:px-8 lg:px-11">
        <div className="mb-7 space-y-2">
          <Skeleton className="h-3 w-24 bg-[#eeebe2]" />
          <Skeleton className="mt-2 h-7 w-48 bg-[#eeebe2]" />
        </div>
        <Skeleton className="h-72 bg-[#eeebe2]" />
      </main>
    )
  }

  if (accountError) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-8 sm:px-8 lg:px-11">
        <PageHeader />
        <div className="flex items-center gap-3 rounded-xl bg-[#f3e4de] p-4 text-[13px] font-medium text-[#8a3f25]">
          <AlertCircle size={18} className="shrink-0" />
          <p>{accountError}</p>
        </div>
      </main>
    )
  }

  if (accounts.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-8 sm:px-8 lg:px-11">
        <PageHeader />
        <Card className="flex flex-col items-center gap-3 border-[#e7e3d9] bg-[#fbfaf6] p-10 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-[#f1eee5] text-[#77796f]">
            <CreditCard size={24} />
          </div>
          <h2 className="font-display text-lg font-extrabold tracking-[-.03em] text-[#252923]">No accounts available</h2>
          <p className="text-[14px] text-[#77796f]">You need an account to make a transfer.</p>
        </Card>
      </main>
    )
  }

  if (activeAccounts.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-8 sm:px-8 lg:px-11">
        <PageHeader />
        <Card className="flex flex-col items-center gap-3 border-[#e7e3d9] bg-[#fbfaf6] p-10 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-[#f1eee5] text-[#77796f]">
            <CreditCard size={24} />
          </div>
          <h2 className="font-display text-lg font-extrabold tracking-[-.03em] text-[#252923]">No active accounts</h2>
          <p className="text-[14px] text-[#77796f]">Your accounts must be active to send money.</p>
        </Card>
      </main>
    )
  }

  // --- Success receipt --------------------------------------------------
  if (stage === 'success' && result) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-8 sm:px-8 lg:px-11">
        <PageHeader />
        <Card className="border-[#e7e3d9] bg-[#fbfaf6] p-7">
          <div className="flex flex-col items-center text-center">
            <span className="grid size-14 place-items-center rounded-full bg-[#eceee3] text-[#4a5240]">
              <CheckCircle2 size={28} />
            </span>
            <h2 className="mt-4 font-display text-xl font-extrabold tracking-[-.03em] text-[#252923]">Transfer complete</h2>
            <p className="mt-1 text-[13px] text-[#77796f]">Your money is on its way.</p>
          </div>

          <dl className="mt-7 space-y-4">
            <ReceiptRow label="Amount" value={formatMoney(result.amount, currency)} emphasize />
            <ReceiptRow label="From" value={`${selectedAccount?.type ?? 'Account'} \u00b7 ${maskAccountNumber(selectedAccount?.accountNumber ?? '')}`} />
            <ReceiptRow label="To account" value={maskAccountNumber(form.toAccountNumber)} />
            {result.description ? <ReceiptRow label="Description" value={result.description} /> : null}
            <ReceiptRow label="Reference" value={result.reference} mono />
            <ReceiptRow
              label="Date"
              value={new Date(result.createdAt).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
            <ReceiptRow label="Status" value={result.status} />
          </dl>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button variant="default" onClick={resetForNewTransfer} className="flex-1">
              <ArrowLeftRight size={16} /> New transfer
            </Button>
            <Button variant="outline" onClick={() => navigate('/activity')} className="flex-1">
              View activity
            </Button>
          </div>
        </Card>
      </main>
    )
  }

  // --- Duplicate / 409 terminal state ----------------------------------
  if (stage === 'error' && submitError) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-8 sm:px-8 lg:px-11">
        <PageHeader />
        <Card className="flex flex-col items-center gap-3 border-[#e7e3d9] bg-[#fbfaf6] p-10 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-[#f3e4de] text-[#8a3f25]">
            <AlertCircle size={28} />
          </span>
          <h2 className="font-display text-lg font-extrabold tracking-[-.03em] text-[#252923]">Transfer not completed</h2>
          <p className="max-w-sm text-[13px] text-[#77796f]">{submitError}</p>
          <Button variant="default" onClick={resetForNewTransfer} className="mt-2">
            Start a new transfer
          </Button>
        </Card>
      </main>
    )
  }

  // --- Form + confirmation ---------------------------------------------
  const showFieldError = (key: keyof FormState) => (touched[key] || stage === 'confirm') && errors[key]

  return (
    <main className="mx-auto max-w-2xl px-5 py-8 sm:px-8 lg:px-11">
      <PageHeader />

      <Card className="border-[#e7e3d9] bg-[#fbfaf6] p-6 sm:p-7">
        {/* Sender account selector */}
        <div className="mb-5">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[.18em] text-[#9a9b91]">From account</label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {activeAccounts.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => update('fromAccountId', a.id)}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition',
                  a.id === form.fromAccountId
                    ? 'border-[#252923] bg-[#252923] text-[#f8f6f0]'
                    : 'border-[#e0dccf] bg-[#fbfaf6] text-[#77796f] hover:border-[#cdc8bb] hover:bg-[#f1eee5]',
                )}
              >
                <CreditCard size={16} className={a.id === form.fromAccountId ? 'text-[#b8bcb1]' : 'text-[#b8bcb1]'} />
                {a.type} &bull;&bull;&bull;&bull; {a.accountNumber.slice(-4)}
              </button>
            ))}
          </div>
          {showFieldError('fromAccountId') && <FieldHint text={errors.fromAccountId!} />}
        </div>

        {/* Available balance */}
        <div className="mb-5 flex items-center justify-between rounded-xl border border-[#e7e3d9] bg-[#f1eee5] px-4 py-3">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-[#9a9b91]">Available balance</span>
          <span className="font-display text-[16px] font-extrabold text-[#252923]">{formatMoney(balance, currency)}</span>
        </div>

        {/* Recipient account number */}
        <div className="mb-5">
          <label htmlFor="toAccountNumber" className="mb-2 block text-[11px] font-bold uppercase tracking-[.18em] text-[#9a9b91]">
            Recipient account number
          </label>
          <Input
            id="toAccountNumber"
            inputMode="numeric"
            placeholder="10-digit account number"
            value={form.toAccountNumber}
            onChange={e => update('toAccountNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
            onBlur={() => handleBlur('toAccountNumber')}
            aria-invalid={!!showFieldError('toAccountNumber')}
            maxLength={10}
          />
          {showFieldError('toAccountNumber') && <FieldHint text={errors.toAccountNumber!} />}
        </div>

        {/* Amount */}
        <div className="mb-5">
          <label htmlFor="amount" className="mb-2 block text-[11px] font-bold uppercase tracking-[.18em] text-[#9a9b91]">
            Amount
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#77796f]">
              {currency === 'INR' ? '\u20B9' : currency}
            </span>
            <Input
              id="amount"
              inputMode="decimal"
              placeholder="0.00"
              className="pl-9"
              value={form.amount}
              onChange={e => update('amount', e.target.value)}
              onBlur={() => handleBlur('amount')}
              aria-invalid={!!showFieldError('amount')}
            />
          </div>
          {showFieldError('amount') && <FieldHint text={errors.amount!} />}
        </div>

        {/* Description */}
        <div className="mb-6">
          <label htmlFor="description" className="mb-2 block text-[11px] font-bold uppercase tracking-[.18em] text-[#9a9b91]">
            Description <span className="font-normal normal-case tracking-normal text-[#b8bcb1]">(optional)</span>
          </label>
          <Input
            id="description"
            placeholder="What is this transfer for?"
            value={form.description}
            onChange={e => update('description', e.target.value.slice(0, 255))}
            onBlur={() => handleBlur('description')}
            maxLength={255}
            aria-invalid={!!showFieldError('description')}
          />
          <div className="mt-1.5 flex items-center justify-between">
            {showFieldError('description') ? <FieldHint text={errors.description!} /> : <span />}
            <span className="text-[11px] text-[#b8bcb1]">{form.description.length}/255</span>
          </div>
        </div>

        {submitError && stage !== 'confirm' && (
          <div className="mb-5 flex items-center gap-3 rounded-xl bg-[#f3e4de] p-4 text-[13px] font-medium text-[#8a3f25]">
            <AlertCircle size={18} className="shrink-0" />
            <p>{submitError}</p>
          </div>
        )}

        <Button variant="terracotta" className="w-full" onClick={proceedToConfirm} disabled={stage === 'submitting'}>
          <Send size={16} /> Review transfer
        </Button>
      </Card>

      {/* Confirmation dialog */}
      {stage === 'confirm' && (
        <ConfirmDialog
          form={form}
          account={selectedAccount}
          currency={currency}
          submitError={submitError}
          submitting={false}
          onConfirm={executeTransfer}
          onCancel={() => {
            setSubmitError('')
            setStage('form')
          }}
        />
      )}

      {/* Submitting overlay (confirm still visible, locked) */}
      {stage === 'submitting' && (
        <ConfirmDialog
          form={form}
          account={selectedAccount}
          currency={currency}
          submitError=""
          submitting
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      )}
    </main>
  )
}

function PageHeader() {
  return (
    <div className="mb-7">
      <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#9a9b91]">Transfer</p>
      <h1 className="mt-1.5 font-display text-[28px] font-extrabold tracking-[-.04em] text-[#252923]">Send money</h1>
    </div>
  )
}

function FieldHint({ text }: { text: string }) {
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-[#8a3f25]">
      <AlertCircle size={13} className="shrink-0" />
      {text}
    </p>
  )
}

function ReceiptRow({ label, value, emphasize, mono }: { label: string; value: string; emphasize?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#eeebe2] pb-3 last:border-0 last:pb-0">
      <dt className="text-[13px] text-[#77796f]">{label}</dt>
      <dd
        className={cn(
          'text-right text-[13px] text-[#252923]',
          emphasize && 'font-display text-[18px] font-extrabold tracking-[-.02em]',
          !emphasize && 'font-semibold',
          mono && 'font-mono text-[12px] break-all',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

interface ConfirmDialogProps {
  form: FormState
  account: Account | undefined
  currency: string
  submitError: string
  submitting: boolean
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({ form, account, currency, submitError, submitting, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#171a16]/50 p-0 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-confirm-title"
        className="w-full max-w-md rounded-t-2xl border border-[#e7e3d9] bg-[#fbfaf6] p-6 shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="transfer-confirm-title" className="font-display text-lg font-extrabold tracking-[-.03em] text-[#252923]">
              Confirm transfer
            </h2>
            <p className="mt-1 text-[12px] text-[#77796f]">Review the details before sending.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg p-1.5 text-[#77796f] hover:bg-[#eeebe2]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <dl className="mt-5 space-y-3.5">
          <ConfirmRow label="From" value={`${account?.type ?? ''} \u00b7 ${maskAccountNumber(account?.accountNumber ?? '')}`} />
          <ConfirmRow label="To account" value={maskAccountNumber(form.toAccountNumber)} />
          <ConfirmRow label="Amount" value={formatMoney(form.amount, currency)} emphasize />
          {form.description.trim() ? <ConfirmRow label="Description" value={form.description.trim()} /> : null}
        </dl>

        <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#f1eee5] px-3 py-2.5 text-[11px] text-[#898b80]">
          <ShieldCheck size={14} className="shrink-0 text-[#a7654b]" />
          <span>Same reference is reused if this transfer is retried after a failure.</span>
        </div>

        {submitError && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-[#f3e4de] p-3.5 text-[13px] font-medium text-[#8a3f25]">
            <AlertCircle size={16} className="shrink-0" />
            <p>{submitError}</p>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={onCancel} disabled={submitting} className="flex-1">
            Go back
          </Button>
          <Button variant="terracotta" onClick={onConfirm} disabled={submitting} className="flex-1">
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Sending…
              </>
            ) : (
              <>
                <Send size={16} /> Confirm &amp; send
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ConfirmRow({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[13px] text-[#77796f]">{label}</dt>
      <dd
        className={cn(
          'text-right text-[13px] text-[#252923]',
          emphasize ? 'font-display text-[17px] font-extrabold tracking-[-.02em]' : 'font-semibold',
        )}
      >
        {value}
      </dd>
    </div>
  )
}
