import { useEffect, useRef } from 'react'

/** Une frappe destinée à un champ de saisie n'est jamais un raccourci. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

/**
 * Raccourci global sur une **lettre nue**.
 *
 * Pas de modificateur, volontairement : dans un navigateur, les combinaisons avec
 * `Ctrl`/`Cmd` sont soit prises (`⌘N` ouvre une fenêtre, `⌘T` un onglet, `⌘L` la barre
 * d'adresse), soit interceptées avant la page. Les lettres seules, elles, n'appartiennent
 * à personne — c'est la convention du web (GitHub, Gmail, Linear). En contrepartie il
 * faut se taire dès que la frappe a un destinataire légitime :
 *
 * - un champ de saisie (l'édition inline d'un titre de tâche doit recevoir son « n ») ;
 * - un overlay ouvert, qui pose déjà ses propres listeners clavier sur `document`
 *   (`Modal`, `Menu`) et dont on ne veut pas doubler le comportement.
 */
export function useHotkey(key: string, handler: () => void): void {
  // Le handler capture du state à chaque rendu ; le garder dans une ref évite de
  // réabonner le listener à chaque frappe du parent.
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const wanted = key.toLowerCase()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== wanted) return
      // On laisse passer tout ce qui porte un modificateur : c'est au navigateur.
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      // Touche maintenue (répétition auto) ou composition IME en cours.
      if (event.repeat || event.isComposing) return
      if (isTypingTarget(event.target)) return
      if (document.querySelector('[role="dialog"], [role="menu"]')) return

      event.preventDefault()
      handlerRef.current()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [key])
}
