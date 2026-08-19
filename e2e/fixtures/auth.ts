import { test as base, expect } from '@playwright/test'
import { AUTH_STORAGE_KEY } from '../local'
import { createTestAccount, type TestAccount } from './account'

type WorkerFixtures = { account: TestAccount }

/**
 * `test` étendu : toute page ouverte démarre authentifiée, sur un compte propre.
 *
 * Le compte est de portée WORKER, pas TEST. La stack locale plafonne à 30
 * inscriptions/connexions par tranche de 5 minutes et par IP
 * (`[auth.rate_limit] sign_in_sign_ups`, supabase/config.toml) : un compte par test
 * ferait échouer la suite dès la deuxième exécution rapprochée, avec une erreur qui
 * n'a rien à voir avec le code testé. Un compte par worker coûte quatre requêtes
 * d'auth par exécution, et `signUp` rend déjà la session en local — aucun
 * `signInWithPassword` derrière.
 *
 * Le partage entre les tests d'un même worker est sans danger à une condition, qui
 * est la règle de toute la suite : chaque test nomme ses données avec un suffixe
 * unique (`helpers/unique.ts`) et n'assert jamais sur un compte global de lignes.
 * Les objectifs font exception et se suppriment après usage — les places sont
 * limitées à 3 principaux et 5 secondaires.
 */
export const test = base.extend<object, WorkerFixtures>({
  account: [
    async ({}, use) => {
      await use(await createTestAccount({ onboarded: true }))
    },
    { scope: 'worker' },
  ],

  page: async ({ page, account }, use) => {
    // `context.addInitScript` et non un `page.evaluate` après navigation : le script
    // doit s'exécuter AVANT le code de l'app. `AuthProvider` appelle `getSession()`
    // dès son montage ; si le storage est vide à cet instant, `ProtectedRoute` a déjà
    // redirigé vers /login et il est trop tard pour écrire quoi que ce soit.
    await page.context().addInitScript(
      ({ key, session }) => {
        // « Rester connecté » décide du store dans src/lib/authStorage.ts. Le défaut
        // est déjà localStorage, mais l'écrire rend le test indépendant de ce défaut.
        window.localStorage.setItem('clarity.remember', '1')
        window.localStorage.setItem(key, session)
      },
      { key: AUTH_STORAGE_KEY, session: JSON.stringify(account.session) },
    )
    await use(page)
  },
})

export { expect }
