import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { OAuthCallbackPage } from '@/features/auth/OAuthCallbackPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ActivityPage } from '@/features/activity/ActivityPage'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
export default function App() { return <BrowserRouter><Routes><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route path="/oauth-callback" element={<OAuthCallbackPage />} /><Route element={<ProtectedRoute />}><Route element={<DashboardLayout />}><Route path="/dashboard" element={<DashboardPage />} /><Route path="/activity" element={<ActivityPage />} /></Route></Route><Route path="*" element={<Navigate to="/dashboard" replace />} /></Routes></BrowserRouter> }
