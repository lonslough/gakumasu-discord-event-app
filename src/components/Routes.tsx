import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Header } from './Header'

const LoginPage = lazy(() => import('../pages/LoginPage').then(({ LoginPage }) => ({ default: LoginPage })))
const EntryPage = lazy(() => import('../pages/EntryPage').then(({ EntryPage }) => ({ default: EntryPage })))
const UsersPage = lazy(() => import('../pages/UsersPage').then(({ UsersPage }) => ({ default: UsersPage })))
const ResponsesPage = lazy(() => import('../pages/ResponsesPage').then(({ ResponsesPage }) => ({ default: ResponsesPage })))
const SettingsPage = lazy(() => import('../pages/SettingsPage').then(({ SettingsPage }) => ({ default: SettingsPage })))

function Loading() {
  return (
    <main className="center-page">
      <div className="spinner" aria-label="読み込み中" />
    </main>
  )
}

function Protected() {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loading />
  if (!session)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return (
    <>
      <Header />
      <Outlet />
    </>
  )
}

function AdminOnly() {
  const { profile, loading } = useAuth()
  if (loading || !profile) return <Loading />
  if (profile.role !== 'admin')
    return <Navigate to="/entry" replace state={{ denied: true }} />
  return <Outlet />
}

export function AppRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Protected />}>
          <Route path="/entry" element={<EntryPage />} />
          <Route element={<AdminOnly />}>
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/responses" element={<ResponsesPage />} />
            <Route path="/admin/settings" element={<SettingsPage />} />
            <Route
              path="/admin/rules"
              element={<Navigate to="/admin/settings" replace />}
            />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/entry" replace />} />
      </Routes>
    </Suspense>
  )
}
