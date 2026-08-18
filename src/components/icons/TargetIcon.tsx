import type { SVGProps } from 'react'

/**
 * La cible, en aplat — le marqueur d'un objectif sur sa carte.
 *
 * `ObjectivesIcon` dit la même chose au trait de 1,8 : c'est ce qu'il faut dans
 * la barre latérale, à 21 px sur fond clair. Posée à 14 px dans une pastille sur
 * un dégradé, elle disparaît. Celle-ci porte l'idée en pleins, anneaux épais et
 * mouche franche : deuxième icône de l'app en aplat après la fusée, et pour la
 * même raison — elle doit tenir en vignette.
 *
 * Les anneaux sont des chemins à deux sous-tracés de sens opposés (`sweep` 1
 * puis 0) : c'est le trou du remplissage non-zéro, sans `fill-rule` à poser.
 */
export function TargetIcon({ className = 'size-3.5', ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <path d="M12 1.6a10.4 10.4 0 1 1 0 20.8 10.4 10.4 0 0 1 0-20.8M12 4.4a7.6 7.6 0 1 0 0 15.2 7.6 7.6 0 0 0 0-15.2" />
      <path d="M12 6.2a5.8 5.8 0 1 1 0 11.6 5.8 5.8 0 0 1 0-11.6M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8" />
      <circle cx="12" cy="12" r="1.8" />
    </svg>
  )
}
