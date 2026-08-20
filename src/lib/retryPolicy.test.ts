import { describe, expect, it } from 'vitest'
import { retryDelay, shouldRetryQuery, transientDelay } from './retryPolicy'

// Ce qui se joue ici : au réveil d'un onglet, huit queries échouent à la même
// milliseconde. Un délai fixe les ferait retenter ensemble et retomber ensemble.

describe('transientDelay — backoff exponentiel à jitter complet', () => {
  it('tire dans [0, base × 2^n], plafonné', () => {
    // `random` injecté à 1 : on lit le plafond de chaque palier.
    const max = (n: number) => transientDelay(n, () => 1)
    expect(max(0)).toBe(500)
    expect(max(1)).toBe(1_000)
    expect(max(2)).toBe(2_000)
    expect(max(3)).toBe(4_000)
    // Le plafond tient même si on demande un palier plus lointain.
    expect(max(10)).toBe(8_000)
  })

  it('garde un plancher : une « nouvelle tentative » immédiate serait une rafale', () => {
    expect(transientDelay(0, () => 0)).toBe(100)
  })

  it('étale vraiment les tentatives d’un même palier', () => {
    const values = new Set([0.1, 0.4, 0.9].map((r) => transientDelay(2, () => r)))
    expect(values.size).toBe(3)
  })
})

describe('retryDelay — le cas PGRST301 garde sa fenêtre courte', () => {
  it('ne passe pas par le backoff : il attend une horloge, pas un serveur', () => {
    const authError = { code: 'PGRST301', message: 'JWT issued at future' }
    expect(retryDelay(0, authError)).toBe(150)
    expect(retryDelay(1, authError)).toBe(400)
    expect(retryDelay(2, authError)).toBe(900)
    expect(retryDelay(3, authError)).toBe(1200)
    // Les quatre tentatives couvrent ~2,6 s, largement la résorption (~1 s).
    expect(retryDelay(9, authError)).toBe(1200)
  })
})

describe('shouldRetryQuery', () => {
  it('retente une réponse qu’on ne sait pas nommer, quatre fois au plus', () => {
    const gateway = { message: '<html>502 Bad Gateway</html>' }
    expect(shouldRetryQuery(0, gateway)).toBe(true)
    expect(shouldRetryQuery(3, gateway)).toBe(true)
    expect(shouldRetryQuery(4, gateway)).toBe(false)
  })

  it('n’essaie même pas une erreur terminale', () => {
    expect(shouldRetryQuery(0, { code: '42501' })).toBe(false)
    expect(shouldRetryQuery(0, { code: 'P0001', message: 'slot_full' })).toBe(false)
  })
})
