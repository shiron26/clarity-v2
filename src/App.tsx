import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import { UpdateBanner } from './components/layout/UpdateBanner'
import { LoginPage } from './features/auth/pages/LoginPage'
import { SignupPage } from './features/auth/pages/SignupPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { HomePage } from './features/home/HomePage'
import { ObjectivesPage } from './features/objectives/pages/ObjectivesPage'
import { BilanPage } from './features/review/pages/BilanPage'
import { ReviewPage } from './features/review/pages/ReviewPage'
import { TasksPage } from './features/tasks/pages/TasksPage'
import { QuarterPage } from './features/year/pages/QuarterPage'
import { YearPage } from './features/year/pages/YearPage'

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
            {/* L'année raconte, le trimestre détaille : deux pages, deux
                adresses partageables. `/annee` ouvre l'année en cours. */}
            <Route path="/annee" element={<YearPage />} />
            <Route path="/annee/:year" element={<YearPage />} />
            <Route path="/annee/:year/:quarter" element={<QuarterPage />} />
            <Route path="/review" element={<ReviewPage />} />
            {/* Le bilan porte sa période dans son adresse, là où le rituel
                ouvre toujours la semaine en cours : c'est ce qui permet au
                bouton de T2 d'ouvrir T2. `:period` vaut `t1`…`t4` ou `annee` —
                le trimestre et l'année sont deux cérémonies distinctes. */}
            <Route path="/bilan/:year/:period" element={<BilanPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App
