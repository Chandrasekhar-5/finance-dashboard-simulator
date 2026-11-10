import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
  Bell,
  ChevronDown,
  CircleHelp,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/AuthProvider'

const navigation = [
  { label: 'Overview', to: '/dashboard', icon: LayoutDashboard, end: true },
  { label: 'Accounts', to: '/dashboard#accounts', icon: CreditCard },
  { label: 'Activity', to: '/dashboard#activity', icon: ArrowLeftRight },
]

export function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function signOut() {
    await logout()
    navigate('/login')
  }

  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'U'

  return (
    <div className="min-h-screen bg-[#f3f0e8] text-[#252923] lg:flex">
      {mobileOpen && <button aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-[#171a16]/40 lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[258px] flex-col border-r border-[#e7e3d9] bg-[#f8f6f0] px-5 py-6 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-2">
          <a href="/dashboard" className="flex items-center gap-3 no-underline">
            <span className="grid size-9 place-items-center rounded-xl bg-[#252923] font-display text-lg font-extrabold text-[#f8f6f0]">N</span>
            <span className="font-display text-[19px] font-extrabold tracking-[-.06em] text-[#252923]">NORTH<span className="text-[#a7654b]">.</span></span>
          </a>
          <button className="rounded-lg p-2 text-[#77796f] hover:bg-[#eeebe2] lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>

        <div className="mt-12 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-[#9a9b91]">Workspace</div>
        <nav className="mt-3 space-y-1">
          {navigation.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={label}
              to={to}
              end={end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `group flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold transition-colors ${isActive ? 'bg-[#e9e6dc] text-[#252923]' : 'text-[#77796f] hover:bg-[#efede5] hover:text-[#252923]'}`}
            >
              <Icon size={17} strokeWidth={1.8} />
              {label}
              {label === 'Activity' && <span className="ml-auto size-1.5 rounded-full bg-[#a7654b]" />}
            </NavLink>
          ))}
        </nav>

        <div className="mt-10 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-[#9a9b91]">Personal</div>
        <div className="mt-3 space-y-1">
          <div className="flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-medium text-[#a2a399]" title="Coming soon">
            <ShieldCheck size={17} strokeWidth={1.8} /> Security <span className="ml-auto text-[9px] uppercase tracking-wider">Soon</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-medium text-[#a2a399]" title="Coming soon">
            <Settings2 size={17} strokeWidth={1.8} /> Preferences <span className="ml-auto text-[9px] uppercase tracking-wider">Soon</span>
          </div>
        </div>

        <div className="mt-auto rounded-2xl border border-[#e7e3d9] bg-[#f1eee5] p-4">
          <div className="flex items-center gap-2 text-[#555b4f]"><CircleHelp size={16} /><span className="text-xs font-semibold">Need a hand?</span></div>
          <p className="mt-2 text-[11px] leading-relaxed text-[#898b80]">Your money, your pace. We're building a calmer way to bank.</p>
          <span className="mt-3 block text-[10px] font-semibold uppercase tracking-widest text-[#a7654b]">North banking · 2026</span>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-[#e7e3d9] bg-[#f3f0e8]/90 backdrop-blur-xl">
          <div className="flex h-[76px] items-center justify-between px-5 sm:px-8 lg:px-11">
            <div className="flex items-center gap-3">
              <button className="rounded-lg p-2 text-[#555b4f] hover:bg-[#e9e6dc] lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
              <div className="hidden text-[11px] font-semibold uppercase tracking-[.16em] text-[#9a9b91] sm:block">Personal banking <span className="mx-2 text-[#c6c2b8]">/</span> <span className="text-[#555b4f]">Overview</span></div>
              <span className="font-display text-lg font-extrabold tracking-[-.06em] lg:hidden">NORTH<span className="text-[#a7654b]">.</span></span>
            </div>
            <div className="flex items-center gap-3 sm:gap-5">
              <button className="relative rounded-full p-2 text-[#686b61] transition hover:bg-[#e9e6dc]" aria-label="Notifications"><Bell size={18} strokeWidth={1.7} /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#a7654b]" /></button>
              <div className="hidden h-7 w-px bg-[#dfdbd1] sm:block" />
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-full bg-[#d9ddce] text-[11px] font-bold text-[#394235]">{initials}</span>
                <div className="hidden leading-tight sm:block"><p className="text-xs font-semibold">{user?.firstName} {user?.lastName}</p><p className="mt-1 text-[10px] text-[#898b80]">Personal account</p></div>
                <ChevronDown size={14} className="hidden text-[#898b80] sm:block" />
              </div>
              <Button variant="ghost" onClick={signOut} aria-label="Sign out" className="h-9 w-9 rounded-full p-0 text-[#77796f] hover:bg-[#e9e6dc]"><LogOut size={16} /></Button>
            </div>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  )
}
