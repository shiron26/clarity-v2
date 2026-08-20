// Le réveil de l'application, en un seul endroit.
//
// Le problème qu'il règle : le jeton d'accès vit une heure, et le minuteur qui le
// renouvelle (interne à supabase-js) NE TOURNE PAS pendant que l'onglet est gelé
// ou que le téléphone dort. Au retour, tout partait en même temps — huit queries
// périmées relancées par le refetch-on-focus, un jeton expiré, son renouvellement
// en vol, et un réseau mobile qui se réveille lui aussi. Chaque requête de cette
// salve dépendait d'un renouvellement qui devait aboutir en quelques centaines de
// millisecondes. Celles qui perdaient la course affichaient une erreur.
//
// La séquence est donc ordonnée : la session D'ABORD, la resynchronisation
// ENSUITE. TanStack expose exactement ce qu'il faut pour ça, `focusManager` :
// on remplace son écouteur nu par le nôtre.
//
// Ce n'est pas un `refreshSession()` — la règle tient toujours (voir
// `queryClient.ts`). `getSession()` ne renouvelle QUE si le jeton est réellement
// expiré, et c'est déjà ce que fait chaque requête via `fetchWithAuth`. On le
// fait une fois, avant, au lieu de huit fois en parallèle et trop tard.
//
// Ce qui n'est volontairement PAS ici : le retour du réseau. `onlineManager` de
// TanStack l'écoute déjà et relance ce qu'il faut ; doubler cet écouteur ne
// ferait que dédoubler la salve.
import { focusManager } from '@tanstack/react-query'
import { supabase } from './supabase'

/**
 * Au-delà, on rend la main sans attendre : un réseau mort ne doit pas figer
 * l'application au retour sur l'onglet. Les requêtes qui partiront quand même
 * seront retentées (`retryPolicy.ts`), et l'échec de transport allumera la
 * pastille de liaison plutôt qu'un bandeau d'erreur.
 */
const SESSION_TIMEOUT_MS = 3_000

let installed = false

function isVisible() {
  return document.visibilityState === 'visible'
}

/**
 * Remettre la session en état, sans jamais dépasser le délai imparti.
 *
 * `getSession()` ne rejette pas dans le cas nominal, mais il peut : le catch
 * garde la promesse de reprise inconditionnelle. Une session réellement morte
 * n'a rien à faire ici non plus, supabase-js émet `SIGNED_OUT` et
 * `AuthProvider` s'en occupe — une sortie propre, au lieu de huit erreurs.
 */
async function settleSession() {
  await Promise.race([
    supabase.auth.getSession().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, SESSION_TIMEOUT_MS)),
  ])
}

export function installAppLifecycle() {
  // Idempotent : le module est importé une fois depuis `main.tsx`, mais le
  // rechargement à chaud de Vite ré-exécute le module.
  if (installed) return
  installed = true

  focusManager.setEventListener((handleFocus) => {
    // Une seule reprise à la fois : `visibilitychange` et `pageshow` peuvent
    // arriver ensemble au retour de bfcache.
    let waking: Promise<void> | null = null

    const wake = () => {
      if (waking) return
      waking = settleSession().then(() => {
        waking = null
        // La visibilité a pu repartir pendant l'attente.
        if (isVisible()) handleFocus(true)
      })
    }

    const onVisibility = () => {
      // `handleFocus(false)` n'est pas une formalité : `setFocused` ne prévient
      // ses abonnés QUE sur un changement. Sans la descente à `false` au moment
      // où l'onglet part, la remontée à `true` au réveil ne déclencherait rien.
      if (!isVisible()) {
        handleFocus(false)
        return
      }
      wake()
    }

    const onPageShow = (event: PageTransitionEvent) => {
      // Retour de bfcache : la page n'est jamais passée par `hidden`, donc rien
      // n'a changé du point de vue du focus. On force le cycle pour que la
      // resynchronisation ait lieu — la page peut avoir dormi des heures.
      if (!event.persisted) return
      handleFocus(false)
      wake()
    }

    window.addEventListener('visibilitychange', onVisibility, false)
    window.addEventListener('pageshow', onPageShow, false)

    return () => {
      window.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onPageShow)
    }
  })
}
