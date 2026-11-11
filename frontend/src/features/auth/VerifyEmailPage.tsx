import { type FormEvent, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CheckCircle2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError, api } from '@/lib/api'

const RESEND_COOLDOWN_SECONDS = 60
const GENERIC_SENT_MESSAGE = 'If an account exists for this email and it still needs verification, a new link is on its way. Check your spam folder too.'
const GENERIC_FAILURE_MESSAGE = 'We could not send the email right now. Please try again in a moment.'

export function VerifyEmailPage() {
  const location = useLocation()
  const initialEmail = typeof location.state?.email === 'string' ? location.state.email : ''
  const [email, setEmail] = useState(initialEmail)
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown(seconds => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setFeedback(null)
    try {
      await api.resendVerification(email)
      setFeedback({ tone: 'success', message: GENERIC_SENT_MESSAGE })
    } catch (cause) {
      // A 400 means the account is already verified; it is reported like a normal send to avoid revealing account state.
      if (cause instanceof ApiError && cause.status === 400) {
        setFeedback({ tone: 'success', message: GENERIC_SENT_MESSAGE })
      } else {
        setFeedback({ tone: 'error', message: GENERIC_FAILURE_MESSAGE })
      }
    } finally {
      setBusy(false)
      setCooldown(RESEND_COOLDOWN_SECONDS)
    }
  }

  const resendDisabled = busy || cooldown > 0 || email.trim() === ''

  return (
    <div className="grid min-h-screen place-items-center bg-[#f3f0e8] px-6 py-12">
      <form onSubmit={resend} className="w-full max-w-[400px] rounded-2xl border border-[#e7e3d9] bg-[#fbfaf6] p-8 shadow-[0_1px_3px_rgba(37,41,35,.05)]">
        <div className="mb-6 lg:hidden">
          <span className="font-display text-2xl font-extrabold tracking-[-.06em] text-[#252923]">NORTH<span className="text-[#a7654b]">.</span></span>
        </div>
        <div className="grid size-12 place-items-center rounded-xl bg-[#eceee3] text-[#4a5240]">
          <Mail size={24} />
        </div>
        <h1 className="mt-5 font-display text-[24px] font-extrabold tracking-[-.04em] text-[#252923]">Verify your email</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#77796f]">
          We sent a verification link to your inbox. Open it to activate your account, then sign in.
        </p>

        {feedback && (
          <div
            role="status"
            className={`mt-5 flex items-start gap-2.5 rounded-xl px-4 py-3 text-[13px] font-medium ${feedback.tone === 'success' ? 'bg-[#eceee3] text-[#4a5240]' : 'bg-[#f3e4de] text-[#8a3f25]'}`}
          >
            {feedback.tone === 'success' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
            <p>{feedback.message}</p>
          </div>
        )}

        <label className="mt-6 block text-[13px] font-semibold text-[#252923]">
          Email
          <Input
            className="mt-1.5 border-[#e0dccf] bg-[#fbfaf6] focus:border-[#a7654b] focus:ring-[#a7654b]/15"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={busy}
            placeholder="you@example.com"
          />
        </label>

        <Button type="submit" className="mt-6 w-full" disabled={resendDisabled}>
          {busy ? 'Sending link…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
        </Button>

        <p className="mt-4 text-[12px] leading-relaxed text-[#9a9b91]">
          Didn&apos;t get it? Check your spam folder. You can request another link once every minute.
        </p>

        <Link to="/login" className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#a7654b] hover:text-[#8a503b]">
          <ArrowLeft size={15} /> Back to sign in
        </Link>
      </form>
    </div>
  )
}
