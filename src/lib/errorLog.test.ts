import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { formatErrorLog, logQueryError, readErrorLog } from './errorLog'

// Même dispositif que `dashboardLayout.test.ts` : un faux `localStorage` en trois
// lignes plutôt qu'un DOM entier. Ces fonctions ne touchent rien d'autre du
// navigateur.

const CLE = 'clarity.errors.v1'

function faireLocalStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  }
}

let stockage: ReturnType<typeof faireLocalStorage>

beforeEach(() => {
  stockage = faireLocalStorage()
  ;(globalThis as { window?: unknown }).window = { localStorage: stockage }
})

afterEach(() => {
  delete (globalThis as { window?: unknown }).window
})

describe('logQueryError', () => {
  it('retient la clé de query, la classe et le code', () => {
    logQueryError(['review', 'openings', [2026]], { code: '', message: 'TypeError: Failed to fetch' }, 1)

    expect(readErrorLog()).toEqual([
      {
        at: 1,
        key: 'review · openings · [2026]',
        kind: 'offline',
        code: null,
        message: 'TypeError: Failed to fetch',
      },
    ])
  })

  it('n’écrit JAMAIS le message d’une règle métier ni d’un conflit', () => {
    // Ces messages-là portent des valeurs de lignes, et ces lignes sont
    // déchiffrées : les poser sur le disque annulerait le chiffrement en base.
    logQueryError(['task', 'list'], { code: 'P0001', message: 'task_recurrence_future: 2026-08-21' }, 1)
    logQueryError(['objective'], { code: '23P01', message: 'conflicting key value (title)=(Perdre 5 kg)' }, 2)

    expect(readErrorLog().map((e) => e.message)).toEqual([null, null])
    // Le code, lui, suffit au diagnostic et ne dit rien de personne.
    expect(readErrorLog().map((e) => e.code)).toEqual(['P0001', '23P01'])
  })

  it('tronque un message trop long', () => {
    logQueryError(['x'], { message: 'a'.repeat(500) }, 1)
    expect(readErrorLog()[0]!.message).toHaveLength(120)
  })

  it('plafonne à 20 entrées, les plus récentes', () => {
    for (let i = 0; i < 25; i++) logQueryError(['x'], { message: 'boum' }, i)

    const entries = readErrorLog()
    expect(entries).toHaveLength(20)
    expect(entries[0]!.at).toBe(5)
    expect(entries[19]!.at).toBe(24)
  })
})

describe('readErrorLog — lecture défensive', () => {
  it('ignore un contenu illisible plutôt que de lever', () => {
    stockage.setItem(CLE, 'pas du JSON')
    expect(readErrorLog()).toEqual([])
  })

  it('écarte les entrées d’une forme inconnue et garde les autres', () => {
    stockage.setItem(CLE, JSON.stringify([{ nawak: true }, { at: 1, key: 'k', kind: 'offline', code: null, message: null }]))
    expect(readErrorLog()).toHaveLength(1)
  })

  it('rend une liste vide quand le stockage n’existe pas', () => {
    delete (globalThis as { window?: unknown }).window
    expect(readErrorLog()).toEqual([])
  })
})

describe('formatErrorLog', () => {
  it('rend une ligne par entrée, copiable telle quelle', () => {
    logQueryError(['profile', 'u-1'], { code: 'PGRST202', message: 'not found' }, 0)
    const texte = formatErrorLog(readErrorLog())

    expect(texte).toContain('PGRST202')
    expect(texte).toContain('profile · u-1')
    expect(texte.split('\n')).toHaveLength(1)
  })

  it('le dit quand il n’y a rien', () => {
    expect(formatErrorLog([])).toBe('Aucune erreur enregistrée.')
  })
})
