import { describe, expect, it } from 'vitest'
import { formatAgo } from './relativeTime'

describe('formatAgo', () => {
  const now = Date.parse('2026-11-12T10:00:00Z')
  const ago = (ms: number) => formatAgo(new Date(now - ms).toISOString(), now)

  it('dit l’écart tant qu’il parle, la date ensuite', () => {
    expect(ago(20_000)).toBe('à l’instant')
    expect(ago(12 * 60_000)).toBe('il y a 12 min')
    expect(ago(3 * 3_600_000)).toBe('il y a 3 h')
    expect(ago(30 * 3_600_000)).toBe('hier')
    expect(ago(3 * 86_400_000)).toBe('il y a 3 jours')
    expect(ago(20 * 86_400_000)).toBe('le 23 oct.')
  })

  it('ne rend jamais un écart négatif (horloge de l’appareil en retard)', () => {
    expect(formatAgo('2026-11-12T10:05:00Z', now)).toBe('à l’instant')
  })
})
