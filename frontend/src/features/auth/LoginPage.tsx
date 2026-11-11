import { type FormEvent, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'

export function LoginPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const [unverifiedEmail, setUnverifiedEmail] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/dashboard" replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email'))
    setBusy(true)
    setError('')
    setUnverifiedEmail('')
    try {
      await login(email, String(form.get('password')))
      navigate('/dashboard', { replace: true })
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 403) setUnverifiedEmail(email)
      setError(cause instanceof Error ? cause.message : 'Unable to sign in')
    } finally {
      setBusy(false)
    }
  }

  const verified = new URLSearchParams(location.search).get('verified') === 'true'

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between bg-[#252923] px-12 py-14 text-[#f8f6f0] lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#f8f6f0] font-display text-xl font-extrabold text-[#252923]">N</span>
          <span className="font-display text-2xl font-extrabold tracking-[-.06em]">NORTH<span className="text-[#a7654b]">.</span></span>
        </div>
        <div>
          <p className="font-display text-[44px] font-extrabold leading-[1.08] tracking-[-.04em]">
            Your money,<br />kept calm.
          </p>
          <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-[#b8bcb1]">
            A quieter, more deliberate way to bank. Sign in to check your balance, move funds, and pick up where you left off.
          </p>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#6b6e63]">North banking &middot; 2026</p>
      </aside>

      <main className="surface-grid flex items-center justify-center bg-[#f3f0e8] px-6 py-12">
        <form onSubmit={submit} className="w-full max-w-[400px] rounded-2xl border border-[#e7e3d9] bg-[#fbfaf6] p-8 shadow-[0_1px_3px_rgba(37,41,35,.05)]">
          <div className="mb-8 lg:hidden">
            <span className="font-display text-2xl font-extrabold tracking-[-.06em] text-[#252923]">NORTH<span className="text-[#a7654b]">.</span></span>
          </div>
          <h1 className="font-display text-[26px] font-extrabold tracking-[-.04em] text-[#252923]">Welcome back</h1>
          <p className="mt-2 text-[14px] text-[#77796f]">Sign in to your account</p>

          {verified && (
            <p className="mt-5 rounded-xl bg-[#eceee3] px-4 py-3 text-[13px] font-medium text-[#4a5240]">
              Email verified &mdash; you can sign in now.
            </p>
          )}
          {error && (
            <div className="mt-5 rounded-xl bg-[#f3e4de] px-4 py-3 text-[13px] font-medium text-[#8a3f25]">
              <p>{error}</p>
              {unverifiedEmail && (
                <Link className="mt-1.5 inline-block font-semibold text-[#a7654b] hover:text-[#8a503b]" to="/verify-email" state={{ email: unverifiedEmail }}>
                  Resend verification email
                </Link>
              )}
            </div>
          )}

          <label className="mt-6 block text-[13px] font-semibold text-[#252923]">
            Email
            <Input className="mt-1.5 border-[#e0dccf] bg-[#fbfaf6] focus:border-[#a7654b] focus:ring-[#a7654b]/15" name="email" type="email" autoComplete="email" required />
          </label>
          <label className="mt-5 block text-[13px] font-semibold text-[#252923]">
            Password
            <Input className="mt-1.5 border-[#e0dccf] bg-[#fbfaf6] focus:border-[#a7654b] focus:ring-[#a7654b]/15" name="password" type="password" autoComplete="current-password" required />
          </label>

          <div className="mt-2.5 text-right">
            <Link className="text-[12px] font-medium text-[#a7654b] hover:text-[#8a503b]" to="/forgot-password">
              Forgot password?
            </Link>
          </div>

          <Button className="mt-7 w-full bg-[#252923] text-[#f8f6f0] hover:bg-[#394235]" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>

          <p className="mt-5 text-center text-[13px] text-[#77796f]">
            New here?{' '}
            <Link className="font-semibold text-[#a7654b] hover:text-[#8a503b]" to="/register">
              Create an account
            </Link>
          </p>
          <p className="mt-3 text-center">
            <a
              className="text-[13px] font-medium text-[#a7654b] hover:text-[#8a503b]"
              href={`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api/v1'}/auth/google`}
            >
              Continue with Google
            </a>
          </p>
        </form>
      </main>
    </div>
  )
}
