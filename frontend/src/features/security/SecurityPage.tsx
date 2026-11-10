import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  Laptop,
  LogOut,
  Monitor,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Tablet,
  Trash2,
  X,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { api, authToken } from '@/lib/api'
import { useAuth } from '@/features/auth/AuthProvider'
import type { Session } from '@/types/api'

const getDeviceId = () => localStorage.getItem('banking-device-id')

function parseUserAgent(ua: string | null): { label: string; icon: typeof Laptop } {
  if (!ua) return { label: 'Unknown device', icon: Laptop }
  const lower = ua.toLowerCase()
  if (lower.includes('iphone') || lower.includes('android') || lower.includes('mobile')) return { label: 'Mobile', icon: Smartphone }
  if (lower.includes('ipad') || lower.includes('tablet')) return { label: 'Tablet', icon: Tablet }
  if (lower.includes('mac')) return { label: 'Mac', icon: Laptop }
  if (lower.includes('windows')) return { label: 'Windows PC', icon: Monitor }
  if (lower.includes('linux')) return { label: 'Linux', icon: Monitor }
  return { label: 'Desktop', icon: Laptop }
}

function parseBrowser(ua: string | null): string {
  if (!ua) return ''
  if (ua.includes('Edg/')) return 'Edge'
  if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Chrome'
  if (ua.includes('Firefox/')) return 'Firefox'
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari'
  return ''
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function SecurityPage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revokingId, setRevokingId] = useState('')
  const [revokeError, setRevokeError] = useState('')
  const [confirmRevoke, setConfirmRevoke] = useState<Session | null>(null)
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false)
  const [logoutAllLoading, setLogoutAllLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const currentDeviceId = getDeviceId()

  const loadSessions = useCallback(async () => {
    const data = await api.sessions()
    setSessions(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => {
    loadSessions()
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Unable to load sessions'))
      .finally(() => setLoading(false))
  }, [loadSessions])

  // Auto-dismiss success messages after 5 seconds
  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => setSuccessMessage(''), 5000)
    return () => clearTimeout(timer)
  }, [successMessage])

  async function handleRevoke(session: Session) {
    setRevokingId(session.id)
    setRevokeError('')
    try {
      await api.revokeSession(session.id)
      setSessions(prev => prev.filter(s => s.id !== session.id))

      // If the user revoked their own current session, the access token is
      // now invalid. Clear local auth state and redirect to login.
      if (session.deviceId && currentDeviceId && session.deviceId === currentDeviceId) {
        authToken.set(null)
        await logout()
        navigate('/login', { replace: true })
        return
      }

      setSuccessMessage('Session revoked successfully.')
      setConfirmRevoke(null)
    } catch (cause) {
      setRevokeError(cause instanceof Error ? cause.message : 'Unable to revoke session')
    } finally {
      setRevokingId('')
    }
  }

  async function handleLogoutAll() {
    setLogoutAllLoading(true)
    try {
      await api.logoutAll()
      // All sessions are now invalid — clear local auth state and redirect.
      authToken.set(null)
      await logout()
      navigate('/login', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to log out from all devices')
      setLogoutAllLoading(false)
      setConfirmLogoutAll(false)
    }
  }

  if (loading) return <SecuritySkeleton />

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:px-11">
      {/* Page header */}
      <div className="mb-7">
        <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#9a9b91]">Security</p>
        <h1 className="mt-1.5 font-display text-[28px] font-extrabold tracking-[-.04em] text-[#252923]">Session management</h1>
        <p className="mt-2 text-[14px] text-[#77796f]">
          Review the devices currently signed in to your NORTH account. Revoke any session you don&apos;t recognize.
        </p>
      </div>

      {/* Success banner */}
      {successMessage && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-[#dde0d3] bg-[#eceee3] p-4 text-[13px] font-medium text-[#4a5240]">
          <CheckCircle2 size={18} className="shrink-0" />
          <p className="flex-1">{successMessage}</p>
          <button onClick={() => setSuccessMessage('')} className="shrink-0 rounded-lg p-1 hover:bg-[#dde0d3]" aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-5 flex items-center gap-3 rounded-xl bg-[#f3e4de] p-4 text-[13px] font-medium text-[#8a3f25]">
          <AlertCircle size={18} className="shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Revoke error */}
      {revokeError && (
        <div className="mb-5 flex items-center gap-3 rounded-xl bg-[#f3e4de] p-4 text-[13px] font-medium text-[#8a3f25]">
          <AlertCircle size={18} className="shrink-0" />
          <p>{revokeError}</p>
          <button onClick={() => setRevokeError('')} className="shrink-0 rounded-lg p-1 hover:bg-[#e8d5cf]" aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Logout all devices */}
      <Card className="mb-6 border-[#e7e3d9] bg-[#fbfaf6] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f3e4de] text-[#8a3f25]">
              <ShieldAlert size={20} />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-[#252923]">Log out from all devices</h2>
              <p className="mt-1 text-[13px] text-[#77796f]">
                Signs out every active session and requires signing in again on each device.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setConfirmLogoutAll(true)} className="shrink-0 border-[#c9b8b0] text-[#8a3f25] hover:bg-[#f3e4de]">
            <LogOut size={16} /> Log out all
          </Button>
        </div>
      </Card>

      {/* Active sessions */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-[.18em] text-[#9a9b91]">
          Active sessions ({sessions.length})
        </h2>
      </div>

      {sessions.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 border-[#e7e3d9] bg-[#fbfaf6] p-10 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-[#f1eee5] text-[#77796f]">
            <ShieldCheck size={24} />
          </div>
          <h3 className="font-display text-lg font-extrabold tracking-[-.03em] text-[#252923]">No active sessions</h3>
          <p className="text-[14px] text-[#77796f]">There are no active login sessions for your account.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {sessions.map(session => {
            const isCurrent = session.deviceId && currentDeviceId && session.deviceId === currentDeviceId
            const { label: deviceLabel, icon: DeviceIcon } = parseUserAgent(session.UserAgent)
            const browser = parseBrowser(session.UserAgent)
            const deviceName = session.deviceName || (browser ? `${browser} on ${deviceLabel}` : deviceLabel)

            return (
              <li key={session.id}>
                <Card className={cn(
                  'flex flex-col gap-4 border p-5 sm:flex-row sm:items-center sm:justify-between',
                  isCurrent ? 'border-[#252923] bg-[#fbfaf6]' : 'border-[#e7e3d9] bg-[#fbfaf6]',
                )}>
                  <div className="flex items-start gap-4">
                    <span className={cn(
                      'grid size-11 shrink-0 place-items-center rounded-xl',
                      isCurrent ? 'bg-[#eceee3] text-[#4a5240]' : 'bg-[#f1eee5] text-[#77796f]',
                    )}>
                      <DeviceIcon size={20} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14px] font-bold text-[#252923]">{deviceName}</p>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#eceee3] px-2 py-0.5 text-[10px] font-semibold text-[#4a5240]">
                            <CheckCircle2 size={11} /> This device
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 space-y-0.5 text-[12px] text-[#77796f]">
                        {session.ipAddress && (
                          <p className="flex items-center gap-1.5">
                            <Globe size={12} className="shrink-0 text-[#a2a399]" />
                            {session.ipAddress}
                          </p>
                        )}
                        <p>Created {formatDate(session.createdAt)}</p>
                        <p>Expires {formatDateTime(session.expiresAt)}</p>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => setConfirmRevoke(session)}
                    disabled={revokingId === session.id}
                    className={cn('shrink-0', isCurrent ? 'border-[#c9b8b0] text-[#8a3f25] hover:bg-[#f3e4de]' : '')}
                  >
                    <Trash2 size={15} />
                    {revokingId === session.id ? 'Revoking…' : 'Revoke'}
                  </Button>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {/* Revoke confirmation dialog */}
      {confirmRevoke && (
        <ConfirmDialog
          title="Revoke this session?"
          message={
            confirmRevoke.deviceId && currentDeviceId && confirmRevoke.deviceId === currentDeviceId
              ? 'This is your current session. Revoking it will sign you out immediately and redirect you to the login page.'
              : 'This will sign out the selected device immediately. The user on that device will need to sign in again.'
          }
          confirmLabel="Revoke session"
          loading={revokingId === confirmRevoke.id}
          onConfirm={() => handleRevoke(confirmRevoke)}
          onCancel={() => {
            setConfirmRevoke(null)
            setRevokeError('')
          }}
        />
      )}

      {/* Logout-all confirmation dialog */}
      {confirmLogoutAll && (
        <ConfirmDialog
          title="Log out from all devices?"
          message="This will immediately sign out every active session, including this one. You will be redirected to the login page."
          confirmLabel="Log out all devices"
          loading={logoutAllLoading}
          onConfirm={handleLogoutAll}
          onCancel={() => setConfirmLogoutAll(false)}
        />
      )}
    </main>
  )
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  loading,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel: string
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-[#171a16]/40" onClick={onCancel} aria-label="Cancel" />
      <Card className="relative w-full max-w-md border-[#e7e3d9] bg-[#fbfaf6] p-6 shadow-[0_8px_30px_rgba(37,41,35,.12)]">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f3e4de] text-[#8a3f25]">
            <ShieldAlert size={20} />
          </span>
          <div className="flex-1">
            <h3 className="font-display text-[17px] font-extrabold tracking-[-.03em] text-[#252923]">{title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[#77796f]">{message}</p>
          </div>
          <button onClick={onCancel} className="shrink-0 rounded-lg p-1.5 text-[#77796f] hover:bg-[#eeebe2]" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant="terracotta" onClick={onConfirm} disabled={loading}>
            {loading ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  )
}

function SecuritySkeleton() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:px-11">
      <div className="mb-7 space-y-2">
        <Skeleton className="h-3 w-20 bg-[#eeebe2]" />
        <Skeleton className="mt-2 h-7 w-52 bg-[#eeebe2]" />
        <Skeleton className="mt-2 h-4 w-80 bg-[#eeebe2]" />
      </div>
      <Skeleton className="mb-6 h-24 bg-[#eeebe2]" />
      <Skeleton className="mb-4 h-4 w-40 bg-[#eeebe2]" />
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-[100px] bg-[#eeebe2]" />
        ))}
      </div>
    </main>
  )
}
