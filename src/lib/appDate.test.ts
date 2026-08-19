import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysOfWeek,
  diffDays,
  endOfWeek,
  isoWeek,
  isoWeekday,
  quarterBounds,
  quarterOf,
  startOfWeek,
} from './appDate'

// L'arithmétique de dates du produit, testée là où elle casse : aux frontières.
//
// C'est exactement ce qu'un test navigateur ne peut PAS produire — on ne fait pas
// tourner l'application au 31 décembre 2026 pour vérifier une semaine ISO. Ici chaque
// cas coûte une microseconde.

describe('isoWeekday', () => {
  it('numérote de 1 (lundi) à 7 (dimanche), et non de 0 à 6', () => {
    expect(isoWeekday('2026-08-17')).toBe(1) // lundi
    expect(isoWeekday('2026-08-23')).toBe(7) // dimanche
  })
})

describe('startOfWeek / endOfWeek', () => {
  it('la semaine va du lundi au dimanche', () => {
    expect(startOfWeek('2026-08-19')).toBe('2026-08-17')
    expect(endOfWeek('2026-08-19')).toBe('2026-08-23')
  })

  it('un dimanche appartient à la semaine qui vient de finir, pas à la suivante', () => {
    // Le piège de toutes les implémentations qui partent du dimanche américain.
    expect(startOfWeek('2026-08-23')).toBe('2026-08-17')
  })

  it('enjambe un changement de mois et d’année', () => {
    expect(startOfWeek('2027-01-01')).toBe('2026-12-28')
    expect(daysOfWeek('2027-01-01')).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ])
  })
})

describe('isoWeek', () => {
  it('rattache le 1er janvier à l’année ISO PRÉCÉDENTE quand sa semaine y a commencé', () => {
    // Le cas qui justifie `periodKey(objectifId, unit, year, index)` : indexer par le
    // seul numéro de semaine est ambigu dès qu'un trimestre enjambe deux années ISO.
    expect(isoWeek('2027-01-01')).toEqual({ isoYear: 2026, isoWeek: 53 })
  })

  it('rattache fin décembre à l’année ISO SUIVANTE quand sa semaine y finit', () => {
    expect(isoWeek('2024-12-30')).toEqual({ isoYear: 2025, isoWeek: 1 })
  })

  it('le 4 janvier est toujours en semaine 1', () => {
    for (const annee of [2024, 2025, 2026, 2027, 2028]) {
      expect(isoWeek(`${annee}-01-04`).isoWeek).toBe(1)
    }
  })
})

describe('addDays / diffDays', () => {
  it('traverse un 29 février', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01')
    expect(diffDays('2028-02-28', '2028-03-01')).toBe(2)
  })

  it('n’est pas trompé par une année non bissextile divisible par 100', () => {
    expect(addDays('2100-02-28', 1)).toBe('2100-03-01')
  })

  it('recule aussi bien qu’il avance', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(diffDays('2026-01-01', '2025-12-31')).toBe(-1)
  })
})

describe('quarterOf / quarterBounds', () => {
  it('découpe l’année en quatre, aux bonnes bornes', () => {
    expect(quarterOf('2026-01-01')).toBe(1)
    expect(quarterOf('2026-03-31')).toBe(1)
    expect(quarterOf('2026-04-01')).toBe(2)
    expect(quarterOf('2026-12-31')).toBe(4)
  })

  it('donne le dernier jour réel de chaque trimestre', () => {
    expect(quarterBounds('2026-02-14')).toEqual({ from: '2026-01-01', to: '2026-03-31' })
    expect(quarterBounds('2026-05-01')).toEqual({ from: '2026-04-01', to: '2026-06-30' })
    expect(quarterBounds('2026-12-31')).toEqual({ from: '2026-10-01', to: '2026-12-31' })
  })

  it('suit février d’une année bissextile', () => {
    expect(quarterBounds('2028-01-15').to).toBe('2028-03-31')
  })
})
