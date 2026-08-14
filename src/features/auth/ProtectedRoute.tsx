import { Navigate, Outlet, useLocation } from 'react-router'
import { Logo } from '../../components/brand/Logo'
import { Spinner } from '../../components/ui/Spinner'
import { useAuth } from './useAuth'

export function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  // pas de flash de redirect
  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-canvas">
        <Logo size="lg" />
        <Spinner className="text-ink-muted" />
      </div>
    )
  }
  if (status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}
