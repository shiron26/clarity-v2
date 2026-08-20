import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_LAYOUT, isDuplicable, readLayout, writeLayout } from './dashboardLayout'

// La disposition de l'accueil : le meilleur candidat du dépôt pour des tests unitaires.
//
// Chaque règle ci-dessous correspond à une régression réelle documentée dans AGENTS.md,
// et chacune tient en trois lignes. Les produire en E2E supposerait de fabriquer un
// localStorage corrompu puis de recharger la page — des secondes, pour moins de
// précision.
//
// `sanitize`, `dedupe` et `migrate` ne sont pas exportés : on les teste à travers
// `readLayout`, qui est le vrai contrat. Tester une fonction privée, c'est figer une
// implémentation ; tester le contrat laisse la liberté de la changer.

const USER = 'u-1'
const CLE = `clarity.dashboard.layout.${USER}`

function faireLocalStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

let stockage: ReturnType<typeof faireLocalStorage>

beforeEach(() => {
  stockage = faireLocalStorage()
  // Un faux `localStorage` en trois lignes plutôt qu'un DOM entier : ces fonctions
  // ne touchent rien d'autre du navigateur.
  ;(globalThis as { window?: unknown }).window = { localStorage: stockage }
})

afterEach(() => {
  delete (globalThis as { window?: unknown }).window
})

/** Écrit une disposition brute, telle qu'un ancien format l'aurait laissée. */
function poser(valeur: unknown) {
  stockage.setItem(CLE, JSON.stringify(valeur))
}

describe('readLayout — rien de stocké', () => {
  it('rend la disposition par défaut', () => {
    expect(readLayout(USER)).toEqual(DEFAULT_LAYOUT)
  })
})

describe('readLayout — une disposition abîmée ne casse rien', () => {
  it('écarte un widget dont l’identifiant n’existe plus dans le code', () => {
    poser({ v: 3, widgets: [{ key: 'a', id: 'objectifs', span: 2 }, { key: 'b', id: 'inbox', span: 1 }] })
    expect(readLayout(USER).map((w) => w.id)).toEqual(['inbox'])
  })

  it('ramène une largeur bricolée à la main sur une valeur permise', () => {
    poser({ v: 3, widgets: [{ key: 'a', id: 'inbox', span: 42 }] })
    expect(readLayout(USER)[0]!.span).toBe(1)
  })

  it('écarte un aide-mémoire de nature inconnue', () => {
    poser({ v: 3, widgets: [{ key: 'a', id: 'memo', memo: 'recettes' }] })
    expect(readLayout(USER)).toEqual([])
  })

  it('retombe sur le défaut devant du JSON illisible', () => {
    stockage.setItem(CLE, 'ceci n’est pas du JSON')
    expect(readLayout(USER)).toEqual(DEFAULT_LAYOUT)
  })

  it('retombe sur le défaut si `widgets` n’est pas un tableau', () => {
    poser({ v: 3, widgets: 'nope' })
    expect(readLayout(USER)).toEqual(DEFAULT_LAYOUT)
  })

  it('donne une clé à un widget qui n’en a pas', () => {
    poser({ v: 3, widgets: [{ id: 'inbox', span: 1 }] })
    expect(readLayout(USER)[0]!.key).toMatch(/.+/)
  })
})

describe('readLayout — reprise d’un format ancien', () => {
  it('traduit « aujourd’hui » en « votre semaine » au lieu de l’effacer', () => {
    // Sans cet alias, les comptes qui avaient posé « Aujourd'hui » auraient
    // simplement perdu leurs tâches du jour.
    poser({ v: 3, widgets: [{ key: 'a', id: 'today', span: 2 }] })
    expect(readLayout(USER).map((w) => w.id)).toEqual(['week'])
  })

  it('ne laisse pas l’alias produire un doublon', () => {
    // Une disposition qui portait LES DEUX se retrouverait sinon avec deux fois la
    // même semaine : un alias suppose un dédoublonnage derrière lui.
    poser({ v: 3, widgets: [{ key: 'a', id: 'today', span: 2 }, { key: 'b', id: 'week', span: 2 }] })
    expect(readLayout(USER).map((w) => w.id)).toEqual(['week'])
  })

  it('accepte le tout premier format, un tableau nu', () => {
    poser([{ key: 'a', id: 'inbox', span: 1 }])
    expect(readLayout(USER).map((w) => w.id)).toContain('inbox')
  })

  it('insère le rituel dans une disposition d’avant qu’il ne soit un widget', () => {
    poser({ v: 1, widgets: [{ key: 'a', id: 'inbox', span: 1 }] })
    expect(readLayout(USER).map((w) => w.id)).toEqual(['ritual', 'inbox'])
  })

  it('n’insère pas le rituel deux fois', () => {
    poser({ v: 1, widgets: [{ key: 'a', id: 'ritual', span: 3 }] })
    expect(readLayout(USER).map((w) => w.id)).toEqual(['ritual'])
  })
})

describe('readLayout — un choix de l’utilisateur ne se défait pas', () => {
  it('garde une disposition vidée jusqu’au dernier widget', () => {
    // Repasser le défaut par-dessus ferait revenir à chaque rechargement les widgets
    // que l'utilisateur vient de retirer.
    poser({ v: 3, widgets: [] })
    expect(readLayout(USER)).toEqual([])
  })

  it('relit ce que writeLayout a écrit', () => {
    writeLayout(USER, [{ key: 'k', id: 'milestones', span: 3 }])
    expect(readLayout(USER)).toEqual([{ key: 'k', id: 'milestones', span: 3 }])
  })
})

describe('isDuplicable', () => {
  it('n’autorise la duplication que des aide-mémoire', () => {
    expect(isDuplicable('memo')).toBe(true)
    expect(isDuplicable('week')).toBe(false)
    expect(isDuplicable('ritual')).toBe(false)
  })

  it('laisse donc coexister deux aide-mémoire, mais pas deux fois la semaine', () => {
    poser({
      v: 3,
      widgets: [
        { key: 'a', id: 'memo', span: 1, memo: 'courses' },
        { key: 'b', id: 'memo', span: 1, memo: 'idees' },
        { key: 'c', id: 'week', span: 2 },
        { key: 'd', id: 'week', span: 2 },
      ],
    })
    expect(readLayout(USER).map((w) => w.id)).toEqual(['memo', 'memo', 'week'])
  })
})
