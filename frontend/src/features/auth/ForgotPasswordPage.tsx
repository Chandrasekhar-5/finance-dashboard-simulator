import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    try {
      await api.forgotPassword(email)
    } catch {
      // The backend always returns a generic success response to prevent
      // email enumeration. We show the same message regardless of outcome.
    } finally {
      setBusy(false)
      setSubmitted(true)
    }
  }

  if (submitted) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f3f0e8] px-6">
        <div className="w-full max-w-[400px] rounded-2xl border border-[#e7e3d9] bg-[#fbfaf6] p-8 shadow-[0_1px_3px_rgba(37,41,35,.05)]">
          <div className="mb-6 lg:hidden">
            <span className="font-display text-2xl font-extrabold tracking-[-.06em] text-[#252923]">NORTH<span className="text-[#a7654b]">.</span></span>
          </div>
          <div className="grid size-12 place-items-center rounded-xl bg-[#eceee3] text-[#4a5240]">
            <CheckCircle2 size={24} />
          </div>
          <h1 className="mt-5 font-display text-[24px] font-extrabold tracking-[-.04em] text-[#252923]">Check your email</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-[#77796f]">
            If an account exists for <span className="font-semibold text-[#252923]">{email}</span>, we&apos;ve sent a link to reset your password. The link is valid for a limited time.
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-[#9a9b91]">
            Don&apos;t see it? Check your spam folder, or try again in a few minutes.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#a7654b] hover:text-[#8a503b]"
          >
            <ArrowLeft size={15} /> Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#f3f0e8] px-6">
      <form onSubmit={submit} className="w-full max-w-[400px] rounded-2xl border border-[#e7e3d9] bg-[#fbfaf6] p-8 shadow-[0_1px_3px_rgba(37,41,35,.05)]">
        <div className="mb-6 lg:hidden">
          <span className="font-display text-2xl font-extrabold tracking-[-.06em] text-[#252923]">NORTH<span className="text-[#a7654b]">.</span></span>
        </div>
        <div className="grid size-12 place-items-center rounded-xl bg-[#eceee3] text-[#4a5240]">
          <Mail size={24} />
        </div>
        <h1 className="mt-5 font-display text-[24px] font-extrabold tracking-[-.04em] text-[#252923]">Forgot password?</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#77796f]">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>

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

        <Button className="mt-7 w-full" disabled={busy}>
          {busy ? 'Sending link…' : 'Send reset link'}
        </Button>

        <Link
          to="/login"
          className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#a7654b] hover:text-[#8a503b]"
        >
          <ArrowLeft size={15} /> Back to sign in
        </Link>
      </form>
    </div>
  )
}
