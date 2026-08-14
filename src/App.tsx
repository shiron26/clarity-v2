import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import { UpdateBanner } from './components/layout/UpdateBanner'
import { LoginPage } from './features/auth/pages/LoginPage'
import { SignupPage } from './features/auth/pages/SignupPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { HomePage } from './features/home/HomePage'
import { ObjectivesPage } from './features/objectives/pages/ObjectivesPage'
import { ReviewPage } from './features/review/pages/ReviewPage'
import { TasksPage } from './features/tasks/pages/TasksPage'

function App() {
  return (
    <>
      {/* Hors des routes : la mise à jour se propose aussi bien connecté que sur
          l'écran de connexion. */}
      <UpdateBanner />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/taches" element={<TasksPage />} />
            <Route path="/objectifs" element={<ObjectivesPage />} />
            <Route path="/review" element={<ReviewPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App
