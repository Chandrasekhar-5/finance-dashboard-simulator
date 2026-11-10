import { type FormEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter.'
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number.'
  return null
}

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(false)

  // No token in the URL — the link is malformed or incomplete.
  if (!token && !success) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f3f0e8] px-6">
        <div className="w-full max-w-[400px] rounded-2xl border border-[#e7e3d9] bg-[#fbfaf6] p-8 shadow-[0_1px_3px_rgba(37,41,35,.05)]">
          <div className="mb-6 lg:hidden">
            <span className="font-display text-2xl font-extrabold tracking-[-.06em] text-[#252923]">NORTH<span className="text-[#a7654b]">.</span></span>
          </div>
          <div className="grid size-12 place-items-center rounded-xl bg-[#f3e4de] text-[#8a3f25]">
            <AlertCircle size={24} />
          </div>
          <h1 className="mt-5 font-display text-[24px] font-extrabold tracking-[-.04em] text-[#252923]">Invalid reset link</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-[#77796f]">
            This password reset link is missing a token. Please request a new reset link.
          </p>
          <Link to="/forgot-password" className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#a7654b] hover:text-[#8a503b]">
            <ArrowLeft size={15} /> Request new link
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f3f0e8] px-6">
        <div className="w-full max-w-[400px] rounded-2xl border border-[#e7e3d9] bg-[#fbfaf6] p-8 shadow-[0_1px_3px_rgba(37,41,35,.05)]">
          <div className="mb-6 lg:hidden">
            <span className="font-display text-2xl font-extrabold tracking-[-.06em] text-[#252923]">NORTH<span className="text-[#a7654b]">.</span></span>
          </div>
          <div className="grid size-12 place-items-center rounded-xl bg-[#eceee3] text-[#4a5240]">
            <CheckCircle2 size={24} />
          </div>
          <h1 className="mt-5 font-display text-[24px] font-extrabold tracking-[-.04em] text-[#252923]">Password updated</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-[#77796f]">
            Your password has been reset successfully. All previous sessions have been signed out. You can now sign in with your new password.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#252923] px-5 py-2.5 text-sm font-semibold text-[#f8f6f0] transition hover:bg-[#394235]"
          >
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError('')

    const pwErr = validatePassword(newPassword)
    const confErr = confirmPassword !== newPassword ? 'Passwords do not match.' : ''
    setPasswordError(pwErr ?? '')
    setConfirmError(confErr)
    if (pwErr || confErr) return

    setBusy(true)
    try {
      await api.resetPassword(token, newPassword)
      setSuccess(true)
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : 'Unable to reset password. The link may have expired or already been used.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#f3f0e8] px-6">
      <form onSubmit={submit} className="w-full max-w-[400px] rounded-2xl border border-[#e7e3d9] bg-[#fbfaf6] p-8 shadow-[0_1px_3px_rgba(37,41,35,.05)]" noValidate>
        <div className="mb-6 lg:hidden">
          <span className="font-display text-2xl font-extrabold tracking-[-.06em] text-[#252923]">NORTH<span className="text-[#a7654b]">.</span></span>
        </div>
        <div className="grid size-12 place-items-center rounded-xl bg-[#eceee3] text-[#4a5240]">
          <KeyRound size={24} />
        </div>
        <h1 className="mt-5 font-display text-[24px] font-extrabold tracking-[-.04em] text-[#252923]">Set a new password</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#77796f]">
          Choose a new password for your account. All active sessions will be signed out.
        </p>

        {submitError && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-[#f3e4de] px-4 py-3 text-[13px] font-medium text-[#8a3f25]">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>{submitError}</p>
          </div>
        )}

        <div className="mt-6">
          <label htmlFor="newPassword" className="block text-[13px] font-semibold text-[#252923]">New password</label>
          <div className="relative mt-1.5">
            <Input
              id="newPassword"
              type={showNew ? 'text' : 'password'}
              autoComplete="new-password"
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setPasswordError('') }}
              disabled={busy}
              className={cn('pr-10', passwordError && 'border-[#c9b8b0] focus:border-[#c9b8b0] focus:ring-[#8a3f25]/15')}
              aria-invalid={!!passwordError}
            />
            <button
              type="button"
              onClick={() => setShowNew(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 grid size-7 place-items-center rounded-lg text-[#77796f] transition hover:bg-[#eeebe2]"
              aria-label={showNew ? 'Hide password' : 'Show password'}
            >
              {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {passwordError ? (
            <p className="mt-1.5 text-[12px] font-medium text-[#8a3f25]">{passwordError}</p>
          ) : (
            <p className="mt-1.5 text-[12px] text-[#9a9b91]">At least 8 characters with one uppercase letter and one number.</p>
          )}
        </div>

        <div className="mt-4">
          <label htmlFor="confirmPassword" className="block text-[13px] font-semibold text-[#252923]">Confirm new password</label>
          <div className="relative mt-1.5">
            <Input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setConfirmError('') }}
              disabled={busy}
              className={cn('pr-10', confirmError && 'border-[#c9b8b0] focus:border-[#c9b8b0] focus:ring-[#8a3f25]/15')}
              aria-invalid={!!confirmError}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 grid size-7 place-items-center rounded-lg text-[#77796f] transition hover:bg-[#eeebe2]"
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {confirmError && <p className="mt-1.5 text-[12px] font-medium text-[#8a3f25]">{confirmError}</p>}
        </div>

        <Button className="mt-7 w-full" disabled={busy}>
          {busy ? 'Resetting password…' : 'Reset password'}
        </Button>

        <Link to="/login" className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#a7654b] hover:text-[#8a503b]">
          <ArrowLeft size={15} /> Back to sign in
        </Link>
      </form>
    </div>
  )
}
