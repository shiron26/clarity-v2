import { describe, expect, it } from 'vitest'
import { badgeFromPayload, safeNotificationPath } from './pushMessages'

describe('badgeFromPayload', () => {
  it('rend un entier positif ou nul tel quel', () => {
    expect(badgeFromPayload(3)).toBe(3)
    expect(badgeFromPayload(0)).toBe(0)
  })

  it("ignore ce qui n'est pas un compte", () => {
    // Un payload d'avant la pastille, ou abîmé en route : on ne touche à rien.
    for (const value of [undefined, null, '3', -1, 2.5, Number.NaN, Infinity]) {
      expect(badgeFromPayload(value)).toBeNull()
    }
  })
})

describe('safeNotificationPath', () => {
  it("n'accepte qu'un chemin interne", () => {
    expect(safeNotificationPath('/taches')).toBe('/taches')
    expect(safeNotificationPath('//evil.example')).toBe('/ma-journee')
    expect(safeNotificationPath('https://evil.example')).toBe('/ma-journee')
    expect(safeNotificationPath(42)).toBe('/ma-journee')
  })
})
