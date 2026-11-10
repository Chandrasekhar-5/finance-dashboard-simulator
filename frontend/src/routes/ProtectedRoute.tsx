import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
export function ProtectedRoute() { const { user, isLoading } = useAuth(); if (isLoading) return <main className="grid min-h-screen place-items-center bg-[#f3f0e8] px-6"><div className="text-center"><span className="font-display text-2xl font-extrabold tracking-[-.06em] text-[#252923]">NORTH<span className="text-[#a7654b]">.</span></span><p className="mt-3 text-sm text-[#77796f]">Restoring your session…</p></div></main>; return user ? <Outlet /> : <Navigate to="/login" replace /> }
