import { isStandalone } from './displayMode'

// « Rester connecté » : supabase-js n'a pas d'option par appel, la persistance se
// décide au niveau du storage passé à createClient. On route donc la session vers
// localStorage (coché) ou sessionStorage (décoché) selon un drapeau, lui-même
// toujours en localStorage pour survivre à la fermeture de l'onglet.
const REMEMBER_KEY = 'clarity.remember'

export function getRemember(): boolean {
  // App installée : le sessionStorage ne survit pas à la fermeture de la fenêtre
  // (et iOS suspend les PWA agressivement), donc s'y appuyer déconnecterait à
  // chaque ouverture. Installer l'app vaut choix de persistance — c'est aussi
  // pourquoi LoginPage masque la case « Rester connecté » dans ce mode.
  if (isStandalone()) return true
  try {
    return window.localStorage.getItem(REMEMBER_KEY) !== '0'
  } catch {
    return true
  }
}

// À appeler AVANT signInWithPassword, sinon la session atterrit dans le mauvais store.
export function setRemember(remember: boolean): void {
  try {
    window.localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0')
  } catch {
    // Stockage indisponible (mode privé strict) : on retombe sur le défaut.
  }
}

function active(): Storage {
  return getRemember() ? window.localStorage : window.sessionStorage
}

function inactive(): Storage {
  return getRemember() ? window.sessionStorage : window.localStorage
}

export const authStorage = {
  getItem(key: string): string | null {
    try {
      return active().getItem(key)
    } catch {
      return null
    }
  },
  setItem(key: string, value: string): void {
    try {
      // Purge l'autre store : sans ça une session persistée avant décochage survivrait.
      inactive().removeItem(key)
      active().setItem(key, value)
    } catch {
      // idem
    }
  },
  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key)
      window.sessionStorage.removeItem(key)
    } catch {
      // idem
    }
  },
}
