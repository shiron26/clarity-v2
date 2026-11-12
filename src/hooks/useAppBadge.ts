// La pastille de l'icône de l'app (PWA installée), tenue à jour tant que l'app
// est ouverte. Le push du matin la pose de son côté, app fermée (`src/sw.ts`).
//
// Un nombre et rien d'autre : la pastille vit dans l'OS, aucun titre n'y va.
// Sans support (navigateur, PWA non installée) ou sans permission de
// notification (iOS l'exige), l'appel est absent ou rejette : on s'en passe.
import { useEffect } from 'react'
import { usePendingTodayCount } from './usePendingTodayCount'

function applyBadge(count: number) {
  if (!('setAppBadge' in navigator)) return
  const call = count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge()
  call.catch(() => undefined)
}

export function useAppBadge() {
  const pending = usePendingTodayCount()

  useEffect(() => {
    // Pendant un chargement, la pastille en place (celle du push) reste juste.
    if (pending !== undefined) applyBadge(pending)
  }, [pending])

  // Monté sous l'authentification : à la déconnexion, la pastille d'un compte
  // ne doit pas rester sur l'icône.
  useEffect(() => () => applyBadge(0), [])
}
