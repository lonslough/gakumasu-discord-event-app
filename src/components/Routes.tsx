import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Header } from './Header'
import { LoginPage } from '../pages/LoginPage'
import { EntryPage } from '../pages/EntryPage'
import { UsersPage } from '../pages/UsersPage'
import { ResponsesPage } from '../pages/ResponsesPage'

function Loading() {
  return <main className="center-page"><div className="spinner" aria-label="読み込み中" /></main>
}

function Protected() {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loading />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <><Header /><Outlet /></>
}

function AdminOnly() {
  const { profile, loading } = useAuth()
  if (loading || !profile) return <Loading />
  if (profile.role !== 'admin') return <Navigate to="/entry" replace state={{ denied: true }} />
  return <Outlet />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Protected />}>
        <Route path="/entry" element={<EntryPage />} />
        <Route element={<AdminOnly />}>
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/responses" element={<ResponsesPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/entry" replace />} />
    </Routes>
  )
}
