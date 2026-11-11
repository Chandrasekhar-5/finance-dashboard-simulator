import { Component, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { VerifyEmailPage } from '@/features/auth/VerifyEmailPage'
import { OAuthCallbackPage } from '@/features/auth/OAuthCallbackPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { AccountsPage } from '@/features/accounts/AccountsPage'
import { ActivityPage } from '@/features/activity/ActivityPage'
import { TransferPage } from '@/features/transfer/TransferPage'
import { SecurityPage } from '@/features/security/SecurityPage'
import { ProtectedRoute } from '@/routes/ProtectedRoute'

interface AppErrorBoundaryProps { children: ReactNode }
interface AppErrorBoundaryState { hasError: boolean }

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application render error', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="grid min-h-screen place-items-center bg-[#f3f0e8] px-6 text-[#252923]">
          <section className="w-full max-w-md rounded-2xl border border-[#e7e3d9] bg-[#fbfaf6] p-8 text-center shadow-[0_1px_3px_rgba(37,41,35,.05)]">
            <span className="font-display text-2xl font-extrabold tracking-[-.06em]">NORTH<span className="text-[#a7654b]">.</span></span>
            <h1 className="mt-6 font-display text-xl font-extrabold">We couldn&apos;t load this page</h1>
            <p className="mt-2 text-sm text-[#77796f]">Refresh the page to try again.</p>
            <button
              className="mt-6 rounded-lg bg-[#252923] px-5 py-2.5 text-sm font-semibold text-[#f8f6f0] hover:bg-[#394235]"
              onClick={() => window.location.reload()}
            >
              Refresh page
            </button>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/oauth-callback" element={<OAuthCallbackPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/transfer" element={<TransferPage />} />
              <Route path="/activity" element={<ActivityPage />} />
              <Route path="/security" element={<SecurityPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AppErrorBoundary>
  )
}
