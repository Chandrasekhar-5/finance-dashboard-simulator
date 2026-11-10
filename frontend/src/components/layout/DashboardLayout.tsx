import { Landmark, LogOut } from 'lucide-react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/AuthProvider'
export function DashboardLayout() { const { user, logout } = useAuth(); const navigate = useNavigate(); async function signOut() { await logout(); navigate('/login') }; return <div className="min-h-screen"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6"><div className="flex items-center gap-2 font-bold"><Landmark className="text-brand" /> Crescent Bank</div><div className="flex items-center gap-3"><span className="hidden text-sm text-muted sm:block">{user?.firstName} {user?.lastName}</span><Button variant="ghost" onClick={signOut} aria-label="Sign out"><LogOut size={18} /><span className="ml-2 hidden sm:block">Sign out</span></Button></div></div></header><Outlet /></div> }
