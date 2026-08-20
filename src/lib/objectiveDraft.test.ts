import { describe, expect, it } from 'vitest'
import {
  directionOf,
  emptyDraft,
  isCustomUnit,
  isDraftReady,
  parseAmount,
  withKind,
  type ObjectiveDraft,
} from './objectiveDraft'

// Le brouillon d'objectif : ce qui décide si le bouton « Créer l'objectif » s'allume,
// et le SENS d'une quantité. `directionOf` en particulier n'est jamais demandée à
// l'utilisateur — elle se déduit, et une déduction fausse retourne tout un objectif.

/** Un brouillon prêt, qu'on abîme ensuite champ par champ. */
function pret(patch: Partial<ObjectiveDraft> = {}): ObjectiveDraft {
  return { ...emptyDraft('principal'), title: 'Courir un marathon', label: 'COURIR', ...patch }
}

describe('directionOf — le sens se déduit, il ne se demande pas', () => {
  it('un point de départ au-dessus de la cible est un objectif à la baisse', () => {
    expect(directionOf(78, 70)).toBe('sous')
  })

  it('en dessous, c’est une montée', () => {
    expect(directionOf(0, 6000)).toBe('atteindre')
  })

  it('bascule quand la cible passe de l’autre côté du départ', () => {
    // La cible est modifiable : partant de 78, la faire passer de 70 à 85 retourne
    // le sens, et `direction` doit suivre.
    expect(directionOf(78, 70)).toBe('sous')
    expect(directionOf(78, 85)).toBe('atteindre')
  })

  it('sans cible, rien ne descend', () => {
    expect(directionOf(78, null)).toBe('atteindre')
  })

  it('départ égal à la cible : pas de descente', () => {
    expect(directionOf(70, 70)).toBe('atteindre')
  })
})

describe('parseAmount — ce que l’utilisateur tape vraiment', () => {
  it('accepte la virgule décimale', () => {
    expect(parseAmount('74,5')).toBe(74.5)
  })

  it('accepte les espaces de milliers, y compris l’insécable', () => {
    expect(parseAmount('6 000')).toBe(6000)
    expect(parseAmount('6 000')).toBe(6000)
  })

  it('rend null sur un champ vide, et non zéro', () => {
    // Zéro est une valeur légitime : les confondre ferait passer un champ vide pour
    // un point de départ à 0.
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('   ')).toBeNull()
    expect(parseAmount('0')).toBe(0)
  })

  it('rend null sur ce qui n’est pas un nombre', () => {
    expect(parseAmount('beaucoup')).toBeNull()
  })
})

describe('isDraftReady — habitude', () => {
  it('les défauts suffisent', () => {
    expect(isDraftReady(pret())).toBe(true)
  })

  it('exige un titre et un nom court', () => {
    expect(isDraftReady(pret({ title: '   ' }))).toBe(false)
    expect(isDraftReady(pret({ label: '' }))).toBe(false)
  })

  it('refuse plus de sept fois par semaine — c’est déjà tous les jours', () => {
    expect(isDraftReady(pret({ cadence: 7 }))).toBe(true)
    expect(isDraftReady(pret({ cadence: 8 }))).toBe(false)
  })

  it('accepte huit fois par MOIS : la borne suit l’unité de période', () => {
    expect(isDraftReady(pret({ periodUnit: 'month', cadence: 8 }))).toBe(true)
  })

  it('laisse la cible totale facultative, mais la refuse à zéro', () => {
    expect(isDraftReady(pret({ targetValue: '' }))).toBe(true)
    expect(isDraftReady(pret({ targetValue: '100' }))).toBe(true)
    expect(isDraftReady(pret({ targetValue: '0' }))).toBe(false)
  })

  it('interdit une habitude à un objectif secondaire', () => {
    // Un secondaire ne demande rien chaque semaine : il n'a pas de rythme à tenir.
    expect(isDraftReady({ ...pret(), kind: 'secondaire', measure: 'habitude' })).toBe(false)
  })
})

describe('isDraftReady — quantité', () => {
  const quantite = (patch: Partial<ObjectiveDraft> = {}) =>
    pret({ measure: 'quantite', entryMode: 'releve', startValue: '78', targetValue: '70', ...patch })

  it('accepte un relevé complet', () => {
    expect(isDraftReady(quantite())).toBe(true)
  })

  it('exige une cible strictement positive', () => {
    expect(isDraftReady(quantite({ targetValue: '' }))).toBe(false)
    expect(isDraftReady(quantite({ targetValue: '0' }))).toBe(false)
  })

  it('exige un point de départ en mode relevé', () => {
    // Vide, il vaudrait zéro — et « perdre du poids » se lirait comme une prise.
    expect(isDraftReady(quantite({ startValue: '' }))).toBe(false)
  })

  it('refuse un départ égal à la cible : il n’y aurait rien à parcourir', () => {
    expect(isDraftReady(quantite({ startValue: '70', targetValue: '70' }))).toBe(false)
  })

  it('ne demande aucun point de départ en cumul : il vaut zéro par définition', () => {
    expect(
      isDraftReady(quantite({ entryMode: 'cumul', startValue: '', targetValue: '6000' })),
    ).toBe(true)
  })
})

describe('isDraftReady — jalons', () => {
  it('exige au moins une étape non vide', () => {
    const jalons = pret({ measure: 'jalons', milestones: ['', '', '', ''] })
    expect(isDraftReady(jalons)).toBe(false)
    expect(isDraftReady({ ...jalons, milestones: ['Code', '', '', ''] })).toBe(true)
  })

  it('ne compte pas une étape faite d’espaces', () => {
    expect(isDraftReady(pret({ measure: 'jalons', milestones: ['   ', '', '', ''] }))).toBe(false)
  })
})

describe('withKind', () => {
  it('bascule un secondaire hors de la mesure « habitude », qui lui est interdite', () => {
    const secondaire = withKind(pret({ measure: 'habitude' }), 'secondaire')
    expect(secondaire.kind).toBe('secondaire')
    expect(secondaire.measure).not.toBe('habitude')
  })
})

describe('isCustomUnit', () => {
  it('ne reconnaît comme personnalisée qu’une unité hors de la liste', () => {
    expect(isCustomUnit('€')).toBe(false)
    expect(isCustomUnit('')).toBe(false)
    expect(isCustomUnit('chapitres')).toBe(true)
  })
})
