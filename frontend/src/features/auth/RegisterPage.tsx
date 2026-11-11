import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email'))
    setBusy(true)
    setError('')
    try {
      await register(String(form.get('firstName')), String(form.get('lastName')), email, String(form.get('password')))
      navigate('/verify-email', { replace: true, state: { email } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between bg-[#252923] px-12 py-14 text-[#f8f6f0] lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#f8f6f0] font-display text-xl font-extrabold text-[#252923]">N</span>
          <span className="font-display text-2xl font-extrabold tracking-[-.06em]">NORTH<span className="text-[#a7654b]">.</span></span>
        </div>
        <div>
          <p className="font-display text-[44px] font-extrabold leading-[1.08] tracking-[-.04em]">
            Open a calmer<br />account today.
          </p>
          <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-[#b8bcb1]">
            Your checking account starts with ₹1,000. No noise, no pressure &mdash; just a better way to manage your money.
          </p>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#6b6e63]">North banking &middot; 2026</p>
      </aside>

      <main className="surface-grid flex items-center justify-center bg-[#f3f0e8] px-6 py-12">
        <form onSubmit={submit} className="w-full max-w-[400px] rounded-2xl border border-[#e7e3d9] bg-[#fbfaf6] p-8 shadow-[0_1px_3px_rgba(37,41,35,.05)]">
          <div className="mb-6 lg:hidden">
            <span className="font-display text-2xl font-extrabold tracking-[-.06em] text-[#252923]">NORTH<span className="text-[#a7654b]">.</span></span>
          </div>
          <h1 className="font-display text-[26px] font-extrabold tracking-[-.04em] text-[#252923]">Create your account</h1>
          <p className="mt-2 text-[14px] text-[#77796f]">Your checking account starts with ₹1,000.</p>

          {error && <p className="mt-5 rounded-xl bg-[#f3e4de] px-4 py-3 text-[13px] font-medium text-[#8a3f25]">{error}</p>}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <label className="text-[13px] font-semibold text-[#252923]">
              First name
              <Input className="mt-1.5 border-[#e0dccf] bg-[#fbfaf6] focus:border-[#a7654b] focus:ring-[#a7654b]/15" name="firstName" required />
            </label>
            <label className="text-[13px] font-semibold text-[#252923]">
              Last name
              <Input className="mt-1.5 border-[#e0dccf] bg-[#fbfaf6] focus:border-[#a7654b] focus:ring-[#a7654b]/15" name="lastName" required />
            </label>
          </div>
          <label className="mt-5 block text-[13px] font-semibold text-[#252923]">
            Email
            <Input className="mt-1.5 border-[#e0dccf] bg-[#fbfaf6] focus:border-[#a7654b] focus:ring-[#a7654b]/15" name="email" type="email" required />
          </label>
          <label className="mt-5 block text-[13px] font-semibold text-[#252923]">
            Password
            <Input className="mt-1.5 border-[#e0dccf] bg-[#fbfaf6] focus:border-[#a7654b] focus:ring-[#a7654b]/15" name="password" type="password" minLength={8} required />
            <span className="mt-1 block text-[12px] font-normal text-[#77796f]">At least 8 characters, one uppercase letter and one number.</span>
          </label>

          <Button className="mt-7 w-full bg-[#252923] text-[#f8f6f0] hover:bg-[#394235]" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </Button>

          <p className="mt-5 text-center text-[13px] text-[#77796f]">
            Already registered?{' '}
            <Link className="font-semibold text-[#a7654b] hover:text-[#8a503b]" to="/login">
              Sign in
            </Link>
          </p>
        </form>
      </main>
    </div>
  )
}
