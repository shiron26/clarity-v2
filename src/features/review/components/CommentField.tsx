import { useEffect, useRef, useState } from 'react'
import { MAX_COMMENT } from '../../../lib/reviewRating'

type CommentFieldProps = {
  /** Ce qui est en base. Toute autre valeur vient de la frappe en cours. */
  value: string
  onCommit: (comment: string | null) => void
  placeholder: string
  label: string
}

/**
 * Les 280 caractères d'un objectif — un commentaire **par objectif**, jamais un
 * commentaire global de période (SPEC §4.4).
 *
 * L'écriture part **au blur**, pas à chaque frappe : une mutation par caractère
 * saturerait la file et ferait clignoter l'état de la cérémonie. Le geste naturel
 * — taper, puis cliquer la fusée ou passer à l'objectif suivant — provoque le
 * blur de lui-même.
 *
 * `synced` retient la dernière valeur venue du serveur. Sans elle, la
 * réconciliation qui suit l'invalidation réécrirait le champ pendant qu'on tape :
 * l'ancien flow de notation avait exactement ce bug, et il se manifestait par des
 * lettres qui reculaient d'un caractère.
 */
export function CommentField({ value, onCommit, placeholder, label }: CommentFieldProps) {
  const [draft, setDraft] = useState(value)
  const synced = useRef(value)

  useEffect(() => {
    if (value === synced.current) return
    synced.current = value
    setDraft(value)
  }, [value])

  function commit() {
    const next = draft.trim()
    if (next === value.trim()) return
    synced.current = next
    // Vider le champ efface la note plutôt que d'y ranger une chaîne vide : la
    // colonne est nullable, et « pas de commentaire » n'est pas « un commentaire
    // vide ».
    onCommit(next === '' ? null : next)
  }

  return (
    <div className="w-full">
      <label className="sr-only" htmlFor="bilan-comment">
        {label}
      </label>
      <input
        id="bilan-comment"
        type="text"
        value={draft}
        maxLength={MAX_COMMENT}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        className="w-full border-b border-deck-idle bg-transparent pb-2 text-center text-ui text-white placeholder:text-ink-onnight-faint focus:border-primary focus:outline-none"
      />
      <p className="mt-1.5 text-right text-caption text-ink-onnight-faint">
        {draft.length}/{MAX_COMMENT}
      </p>
    </div>
  )
}
