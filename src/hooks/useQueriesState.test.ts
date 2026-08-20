import { describe, expect, it, vi } from 'vitest'
import { firstLoadError, selectErrorState, type QueryLike } from './useQueriesState'

// La règle testée ici est celle qui a produit le bandeau collé : TanStack garde
// `data` quand un rafraîchissement en arrière-plan échoue, et passe quand même
// `status: 'error'`. Un écran complet affichait donc un bloc rouge que seul un
// rechargement effaçait.

function query(over: Partial<QueryLike> = {}): QueryLike {
  return {
    error: null,
    isLoadingError: false,
    isFetching: false,
    refetch: () => Promise.resolve(),
    ...over,
  }
}

const boum = new Error('boum')
const refus = Object.assign(new Error('permission denied'), { code: '42501' })

describe('selectErrorState — ce qui se montre', () => {
  it('se tait quand un refetch rate par-dessus des données déjà affichées', () => {
    const state = selectErrorState([query({ error: boum })])
    expect(state.firstError).toBeNull()
  })

  it('parle quand il n’y a rien à afficher', () => {
    const state = selectErrorState([query({ error: boum, isLoadingError: true })])
    expect(state.firstError).toBe(boum)
  })

  it('parle aussi d’une erreur terminale, même avec des données à l’écran', () => {
    // Un refus de droits ne passera pas tout seul, et sa copie dit quoi faire :
    // le taire laisserait l'utilisateur devant un écran qui ne se met plus à jour.
    const state = selectErrorState([query({ error: refus })])
    expect(state.firstError).toBe(refus)
  })

  it('montre la première erreur affichable, pas la première erreur tout court', () => {
    const state = selectErrorState([
      query({ error: boum }),
      query({ error: refus }),
    ])
    expect(state.firstError).toBe(refus)
  })
})

describe('selectErrorState — ce qui se relance', () => {
  it('relance TOUT ce qui a échoué, y compris ce qui ne s’affiche pas', () => {
    // C'est la moitié du bug : sur le dashboard, l'erreur venait d'un hook
    // composite dont les queries n'étaient pas passées, et « Réessayer » tournait
    // sur une liste vide.
    const muet = vi.fn(() => Promise.resolve())
    const visible = vi.fn(() => Promise.resolve())
    const sain = vi.fn(() => Promise.resolve())

    selectErrorState([
      query({ error: boum, refetch: muet }),
      query({ error: refus, refetch: visible }),
      query({ refetch: sain }),
    ]).onRetry()

    expect(muet).toHaveBeenCalledOnce()
    expect(visible).toHaveBeenCalledOnce()
    expect(sain).not.toHaveBeenCalled()
  })

  it('« Réessayer » tourne tant qu’une query en échec est en vol', () => {
    expect(selectErrorState([query({ error: boum, isFetching: true })]).retrying).toBe(true)
    expect(selectErrorState([query({ isFetching: true })]).retrying).toBe(false)
  })
})

describe('selectErrorState — l’erreur de mutation', () => {
  it('sert de repli quand aucune query n’a d’erreur à montrer', () => {
    const mutation = new Error('ouverture impossible')
    expect(selectErrorState([query()], mutation).firstError).toBe(mutation)
    expect(selectErrorState([query({ error: boum })], mutation).firstError).toBe(mutation)
  })

  it('ne prime pas sur une erreur d’écran', () => {
    const mutation = new Error('ouverture impossible')
    const state = selectErrorState([query({ error: boum, isLoadingError: true })], mutation)
    expect(state.firstError).toBe(boum)
  })
})

describe('firstLoadError — la même règle pour un widget', () => {
  it('laisse un widget garder ses lignes quand son refetch rate', () => {
    expect(firstLoadError(query({ error: boum }))).toBeNull()
    expect(firstLoadError(query({ error: boum, isLoadingError: true }))).toBe(boum)
  })
})
