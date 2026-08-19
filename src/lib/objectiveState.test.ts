import { describe, expect, it } from 'vitest'
import { distinctDays, heatLevel, quantityPercent, sessionKey, targetPercent } from './objectiveState'

// La progression d'un objectif. `quantityPercent` porte à elle seule la régression la
// plus coûteuse du produit, et elle a six cas là où l'E2E n'en jouera jamais qu'un ou
// deux — c'est la raison d'être de ce fichier.

/** Le minimum que la fonction lit. */
function objectif(start: number | null, target: number | null, down: boolean) {
  return { start_value: start, target_value: target, direction: down ? 'sous' : 'atteindre' } as const
}

describe('quantityPercent — la progression se mesure sur le CHEMIN, pas sur la cible', () => {
  it('à la baisse, le jour de la création : 0 %, et surtout pas « atteint »', () => {
    // La régression historique : `valeur / cible` donnait 78/70 = 111 %, borné à
    // 100 — donc « cible atteinte » sur une perte de poids qui n'a pas commencé.
    expect(quantityPercent(objectif(78, 70, true), 78)).toBe(0)
  })

  it('à la baisse, à mi-chemin', () => {
    expect(quantityPercent(objectif(78, 70, true), 74)).toBe(50)
  })

  it('à la baisse, cible atteinte puis dépassée : borné à 100', () => {
    expect(quantityPercent(objectif(78, 70, true), 70)).toBe(100)
    expect(quantityPercent(objectif(78, 70, true), 65)).toBe(100)
  })

  it('à la baisse, en recul : borné à 0 plutôt qu’en négatif', () => {
    // Une largeur CSS négative est ignorée : la barre resterait pleine sans que
    // rien ne dise pourquoi.
    expect(quantityPercent(objectif(78, 70, true), 82)).toBe(0)
  })

  it('à la hausse depuis un point de départ non nul', () => {
    // Sans l'origine, un relevé de 82 vers 90 démarrerait à 91 % sans rien avoir fait.
    expect(quantityPercent(objectif(82, 90, false), 82)).toBe(0)
    expect(quantityPercent(objectif(82, 90, false), 86)).toBe(50)
  })

  it('un cumul part de zéro : la formule se réduit à valeur / cible', () => {
    expect(quantityPercent(objectif(0, 6000, false), 3000)).toBe(50)
  })

  it('rend null quand il n’y a rien à parcourir', () => {
    // Départ égal à la cible, ou du mauvais côté : la barre disparaît plutôt que
    // d'afficher un 0 % ou un 100 % qui ne veulent rien dire.
    expect(quantityPercent(objectif(70, 70, false), 70)).toBeNull()
    expect(quantityPercent(objectif(60, 70, true), 65)).toBeNull()
  })

  it('rend null sans cible', () => {
    expect(quantityPercent(objectif(0, null, false), 10)).toBeNull()
  })

  it('traite un point de départ absent comme un zéro', () => {
    expect(quantityPercent(objectif(null, 100, false), 25)).toBe(25)
  })
})

describe('targetPercent', () => {
  it('borne des deux côtés', () => {
    expect(targetPercent(0, 4)).toBe(0)
    expect(targetPercent(2, 4)).toBe(50)
    expect(targetPercent(9, 4)).toBe(100)
    expect(targetPercent(-1, 4)).toBe(0)
  })

  it('rend null quand rien n’est attendu', () => {
    expect(targetPercent(3, 0)).toBeNull()
  })
})

describe('distinctDays — on compte des jours, pas des efforts', () => {
  it('un même jour sur trois objectifs reste un seul jour', () => {
    const keys = new Set([
      sessionKey('o1', '2026-08-17'),
      sessionKey('o2', '2026-08-17'),
      sessionKey('o3', '2026-08-17'),
    ])
    expect(distinctDays(keys)).toBe(1)
  })

  it('compte les jours différents', () => {
    const keys = new Set([sessionKey('o1', '2026-08-17'), sessionKey('o1', '2026-08-18')])
    expect(distinctDays(keys)).toBe(2)
  })

  it('rend zéro sur un jeu vide', () => {
    expect(distinctDays(new Set())).toBe(0)
  })
})

describe('heatLevel', () => {
  it('rend 0 tant que rien n’est fait', () => {
    expect(heatLevel(0, 3)).toBe(0)
  })

  it('monte avec la part accomplie, sans dépasser la dernière marche', () => {
    expect(heatLevel(3, 3)).toBe(5)
    expect(heatLevel(9, 3)).toBe(5)
  })

  it('sans cible, toute activité vaut la dernière marche', () => {
    expect(heatLevel(1, 0)).toBe(5)
  })
})
