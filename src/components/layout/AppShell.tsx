import { useState } from 'react'
import { Outlet } from 'react-router'
import { ComebackFlow } from '../../features/comeback/ComebackFlow'
import { OnboardingFlow } from '../../features/onboarding/OnboardingFlow'
import { NewTaskHost } from '../../features/tasks/NewTaskHost'
import { MobileTabBar } from './MobileTabBar'
import { MobileTopBar } from './MobileTopBar'
import { PrivacyProvider } from './PrivacyProvider'
import { PageBannerSlotContext } from './pageBannerSlot'
import { Sidebar } from './Sidebar'
import { TopBarSlotContext } from './topBarSlot'

// Cadre applicatif : sidebar en desktop, top bar + barre d'onglets en mobile.
export function AppShell() {
  // Le nœud d'actions de la barre mobile, tenu en state (et non en ref) : c'est
  // ce qui provoque le rendu qui permet à l'écran de s'y portailler.
  const [topBarSlot, setTopBarSlot] = useState<HTMLDivElement | null>(null)
  // La bannière d'un écran, au-dessus de la zone qui défile — voir
  // `pageBannerSlot.ts` pour la raison d'être de ce second emplacement.
  const [bannerSlot, setBannerSlot] = useState<HTMLDivElement | null>(null)

  return (
    // Le mode masqué enveloppe TOUTE la coquille, sidebar comprise : le bouton
    // qui le bascule y vit, et les quatre écrans le lisent. « Masquer » est un
    // état de l'application, pas une préférence d'un écran.
    <PrivacyProvider>
      <div className="flex h-dvh bg-canvas">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileTopBar actionsRef={setTopBarSlot} />
          {/* Vide, ce nœud ne mesure rien : il ne pousse le contenu que quand un
              écran y rend quelque chose. */}
          <div ref={setBannerSlot} className="shrink-0" />
          <main className="min-h-0 flex-1 overflow-y-auto px-5 py-5 lg:px-8 lg:py-7">
            <TopBarSlotContext value={topBarSlot}>
              <PageBannerSlotContext value={bannerSlot}>
                <Outlet />
              </PageBannerSlotContext>
            </TopBarSlotContext>
          </main>
          <MobileTabBar />
        </div>
        {/* Overlays disponibles sur tous les écrans authentifiés. `NewTaskHost` porte
            le raccourci « N » et ouvre la modale sans quitter la route courante.
            `OnboardingFlow` est opaque : tant qu'il est là, la coquille n'existe pas.
            `ComebackFlow` s'ouvre tout seul après une longue absence — les deux ne
            peuvent pas se croiser, quelqu'un qui revient est onboardé. */}
        <NewTaskHost />
        <OnboardingFlow />
        <ComebackFlow />
      </div>
    </PrivacyProvider>
  )
}
