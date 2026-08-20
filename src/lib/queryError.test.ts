import { describe, expect, it } from 'vitest'
import { classifyError, isTerminalError } from './queryError'

// Le classement d'une erreur décide de deux choses invisibles : ce que l'utilisateur
// lit, et si la requête est retentée. Se tromper de classe, c'est afficher « une erreur
// est survenue de notre côté » sur un conflit de données, ou retenter à l'infini une
// requête qui ne passera jamais.
//
// Deux pièges de forme sont testés ici parce qu'ils ont déjà mordu : avec
// `if (error) throw error`, postgrest-js lance un objet NU — pas une instance de
// `PostgrestError`, et sans statut HTTP. Et un fetch qui n'aboutit pas produit
// `code: ''`, pas `undefined`.

describe('classifyError — le fetch qui n’aboutit pas', () => {
  it('se reconnaît à son code VIDE, quel que soit le message', () => {
    // `code: ''` et non `undefined` : tout test du genre `typeof code === 'string'`
    // rangerait l'offline avec les erreurs métier et le rendrait non retentable.
    expect(classifyError({ code: '', message: 'TypeError: Failed to fetch' })).toBe('offline')
  })

  it('couvre les erreurs d’auth jetées pendant la résolution du jeton', () => {
    // Le cas qui produisait le bandeau collé au réveil de l'onglet : supabase-js
    // résout le bearer AVANT de partir, et ce qui est jeté là porte un `name` que
    // l'ancien regex sur le message ne reconnaissait pas. Résultat : `unknown`,
    // donc zéro tentative, donc un bandeau définitif.
    expect(classifyError({ code: '', message: 'AuthSessionMissingError: Auth session missing!' })).toBe(
      'offline',
    )
  })

  it('une panne réseau de GoTrue se reconnaît à son NOM', () => {
    expect(classifyError({ name: 'AuthRetryableFetchError', status: 0 })).toBe('offline')
  })

  it('un TypeError nu est une panne de transport', () => {
    expect(classifyError(new TypeError('Failed to fetch'))).toBe('offline')
  })

  it('ne confond pas code VIDE et code ABSENT', () => {
    // Corps de réponse non-JSON (page d'erreur d'une passerelle) : postgrest-js
    // renvoie `{ message }` sans champ `code`. Ce n'est pas du transport, c'est
    // une réponse qu'on ne sait pas nommer.
    expect(classifyError({ message: '<html>502 Bad Gateway</html>' })).toBe('unknown')
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
  it('PGRST301 est transitoire : le JWT est trop frais d’une seconde', () => {
    expect(classifyError({ code: 'PGRST301', message: 'JWT issued at future' })).toBe(
      'authTransient',
    )
  })

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

  it('nomme les règles métier des triggers', () => {
    // Elles arrivent toutes en P0001 ; seule la chaîne les distingue, et c'est
    // `errorMessage.ts` qui la traduit. Le classement n'a qu'à savoir que ce
    // n'est pas une panne.
    expect(classifyError({ code: 'P0001', message: 'slot_full' })).toBe('businessRule')
  })

  it('retombe sur le statut HTTP quand il n’y a pas de code', () => {
    expect(classifyError({ status: 401 })).toBe('authGone')
    expect(classifyError({ status: 403 })).toBe('authGone')
  })

  it('ne devine rien de ce qu’il ne reconnaît pas', () => {
    expect(classifyError(null)).toBe('unknown')
    expect(classifyError('une chaîne')).toBe('unknown')
  })
})

describe('isTerminalError — la liste des exceptions', () => {
  it('ne retente pas ce qui ne passera jamais', () => {
    expect(isTerminalError({ code: '42501' })).toBe(true)
    expect(isTerminalError({ code: 'PGRST116' })).toBe(true)
    expect(isTerminalError({ code: '23P01' })).toBe(true)
    expect(isTerminalError({ code: 'PGRST302' })).toBe(true)
    expect(isTerminalError({ code: 'P0001', message: 'slot_full' })).toBe(true)
  })

  it('traite une requête malformée ou un cache de schéma comme un bug, pas un hoquet', () => {
    expect(isTerminalError({ code: 'PGRST202', message: 'function not found' })).toBe(true)
    expect(isTerminalError({ code: 'PGRST100' })).toBe(true)
  })

  it('retente tout le reste, y compris ce qu’il ne sait pas nommer', () => {
    // C'est l'inversion qui compte : avant, `unknown` n'était retenté ZÉRO fois,
    // et un 502 au réveil se figeait à l'écran jusqu'au rechargement.
    expect(isTerminalError({ message: '<html>502 Bad Gateway</html>' })).toBe(false)
    expect(isTerminalError({ code: '', message: 'TypeError: Failed to fetch' })).toBe(false)
    expect(isTerminalError({ code: 'PGRST301' })).toBe(false)
    expect(isTerminalError({ code: '57014', message: 'canceling statement due to statement timeout' })).toBe(
      false,
    )
  })
})
