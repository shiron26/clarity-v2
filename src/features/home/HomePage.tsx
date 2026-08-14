import { DashboardView } from './components/DashboardView'
import { DashboardPrefsProvider } from './DashboardPrefsProvider'

// Le provider de préférences reste interne à la feature : le dashboard est le
// seul écran qui les consomme, App.tsx n'a pas à en connaître l'existence.
export function HomePage() {
  return (
    <DashboardPrefsProvider>
      <DashboardView />
    </DashboardPrefsProvider>
  )
}
