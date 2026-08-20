import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getTransportFailures,
  noteRequestSuccess,
  noteTransportFailure,
  resetConnectivity,
  subscribeToConnectivity,
} from './connectivity'

afterEach(() => resetConnectivity())

describe('connectivity', () => {
  it('compte les échecs de transport et se répare au premier succès', () => {
    noteTransportFailure()
    noteTransportFailure()
    expect(getTransportFailures()).toBe(2)

    noteRequestSuccess()
    expect(getTransportFailures()).toBe(0)
  })

  it('ne prévient ses abonnés que sur un vrai changement', () => {
    // Sans ce garde-fou, chaque requête réussie ferait re-rendre la coquille
    // entière alors que rien n'a bougé.
    const abonne = vi.fn()
    subscribeToConnectivity(abonne)

    noteRequestSuccess()
    expect(abonne).not.toHaveBeenCalled()

    noteTransportFailure()
    noteRequestSuccess()
    expect(abonne).toHaveBeenCalledTimes(2)
  })

  it('se désabonne', () => {
    const abonne = vi.fn()
    const stop = subscribeToConnectivity(abonne)
    stop()

    noteTransportFailure()
    expect(abonne).not.toHaveBeenCalled()
  })
})
