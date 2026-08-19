import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Les sélecteurs partagés, et la raison d'être de ce fichier : `exact: true`.
 *
 * Par défaut, l'option `name` de `getByRole` compare en **sous-chaîne, insensible à la
 * casse**. Or `TaskCheckbox` compose son libellé en `Cocher <titre>` ou
 * `Décocher <titre>` : sans `exact`, un locator « Cocher X » matche AUSSI « Décocher X »
 * — « Décocher X » contient « cocher X ». Le compte est alors faux d'exactement un, ce
 * qui ressemble trait pour trait à la régression de doublon qu'on cherche à détecter.
 * C'est le genre de faux positif qui fait perdre une soirée.
 */
export function tacheOuverte(scope: Page | Locator, titre: string): Locator {
  return scope.getByRole('checkbox', { name: `Cocher ${titre}`, exact: true })
}

export function tacheCochee(scope: Page | Locator, titre: string): Locator {
  return scope.getByRole('checkbox', { name: `Décocher ${titre}`, exact: true })
}

/**
 * Déplie la section « Terminées (n) », repliée par défaut.
 *
 * Sans ce dépliage, une tâche cochée est simplement absente du DOM : elle a quitté la
 * liste courante pour cette section. Un test qui la chercherait après l'avoir cochée
 * attendrait un élément qui n'existe pas.
 *
 * IDEMPOTENT, et ce n'est pas un raffinement : le bouton est une bascule, donc un
 * second appel dans le même test refermerait la section et ferait échouer l'assertion
 * suivante avec un « 0 élément » très trompeur. On lit `aria-expanded` plutôt que de
 * mémoriser l'état côté test.
 */
export async function deplierTerminees(page: Page): Promise<void> {
  const bouton = page.getByRole('button', { name: /^Terminées \(/ })
  await expect(bouton).toBeVisible()
  if ((await bouton.getAttribute('aria-expanded')) !== 'true') {
    await bouton.click()
  }
  await expect(bouton).toHaveAttribute('aria-expanded', 'true')
}
