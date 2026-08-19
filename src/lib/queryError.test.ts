import { describe, expect, it } from 'vitest'
import { classifyError, isRetryableKind } from './queryError'

// Le classement d'une erreur décide de deux choses invisibles : ce que l'utilisateur
// lit, et si la requête est retentée. Se tromper de classe, c'est afficher « une erreur
// est survenue de notre côté » sur un conflit de données, ou retenter à l'infini une
// requête qui ne passera jamais.
//
// Deux pièges de forme sont testés ici parce qu'ils ont déjà mordu : avec
// `if (error) throw error`, postgrest-js lance un objet NU — pas une instance de
// `PostgrestError`, et sans statut HTTP. Et une panne réseau produit `code: ''`, pas
// `undefined`.

describe('classifyError — les deux seules erreurs retentables', () => {
  it('PGRST301 est transitoire : le JWT est trop frais d’une seconde', () => {
    expect(classifyError({ code: 'PGRST301', message: 'JWT issued at future' })).toBe(
      'authTransient',
    )
    expect(isRetryableKind('authTransient')).toBe(true)
  })

  it('une panne réseau de postgrest-js se reconnaît à son code VIDE', () => {
    // `code: ''` et non `undefined` : tout test du genre `typeof code === 'string'`
    // rangerait l'offline avec les erreurs métier et le rendrait non retentable.
    expect(classifyError({ code: '', message: 'TypeError: Failed to fetch' })).toBe('offline')
    expect(isRetryableKind('offline')).toBe(true)
  })

  it('une panne réseau de GoTrue se reconnaît à son NOM', () => {
    expect(classifyError({ name: 'AuthRetryableFetchError', status: 0 })).toBe('offline')
  })

  it('un TypeError nu est une panne de transport', () => {
    expect(classifyError(new TypeError('Failed to fetch'))).toBe('offline')
  })

  it('rien d’autre n’est retentable', () => {
    for (const kind of ['authGone', 'permission', 'notFound', 'conflict', 'unknown'] as const) {
      expect(isRetryableKind(kind)).toBe(false)
    }
  })
})

describe('classifyError — les conflits de données', () => {
  it('classe la collision de fenêtre 23P01 en conflit, pas en erreur de notre côté', () => {
    // Depuis que les places sont uniques par CHEVAUCHEMENT de fenêtre, une collision
    // remonte en 23P01 et non plus en 23505. Sans ce cas, elle tombait en `unknown`,
    // donc se lisait « une erreur est survenue de notre côté ».
    expect(classifyError({ code: '23P01', message: 'conflicting key value' })).toBe('conflict')
  })

  it('classe aussi l’unicité, la clé étrangère et le check', () => {
    for (const code of ['23505', '23503', '23514']) {
      expect(classifyError({ code })).toBe('conflict')
    }
  })
})

describe('classifyError — le reste', () => {
  it('distingue une session morte d’une session trop fraîche', () => {
    expect(classifyError({ code: 'PGRST302' })).toBe('authGone')
    expect(classifyError({ code: 'session_expired' })).toBe('authGone')
    expect(classifyError({ code: 'refresh_token_not_found' })).toBe('authGone')
  })

  it('reconnaît un refus de la RLS', () => {
    expect(classifyError({ code: '42501' })).toBe('permission')
  })

  it('reconnaît un `.single()` sans ligne', () => {
    expect(classifyError({ code: 'PGRST116' })).toBe('notFound')
  })

  it('retombe sur le statut HTTP quand il n’y a pas de code', () => {
    expect(classifyError({ status: 401 })).toBe('authGone')
    expect(classifyError({ status: 403 })).toBe('authGone')
  })

  it('ne devine rien de ce qu’il ne reconnaît pas', () => {
    expect(classifyError({ code: 'P0001', message: 'slot_full' })).toBe('unknown')
    expect(classifyError(null)).toBe('unknown')
    expect(classifyError('une chaîne')).toBe('unknown')
  })
})
