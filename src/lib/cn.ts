import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// tailwind-merge ne connaît que l'échelle par défaut : sans ça il range `text-title`
// ou `text-ui` dans le groupe « couleur de texte » et écrase `text-white`.
// Idem pour nos ombres nommées.
const twMerge = extendTailwindMerge({
  extend: {
    // `radius` est un thème, pas un groupe : c'est ce qui fait reconnaître d'un coup
    // `rounded-panel`, `rounded-t-panel`, `rounded-bl-panel`… L'échelle par défaut de
    // tailwind-merge s'arrête à `none | full | <taille t-shirt>`.
    theme: {
      radius: ['panel'],
    },
    classGroups: {
      'font-size': [
        { text: ['micro', 'caption', 'label', 'body', 'ui', 'card', 'title', 'h1', 'display'] },
      ],
      shadow: [
        {
          shadow: [
            'card',
            'modal',
            'dropdown',
            'primary',
            'primary-hover',
            'primary-active',
            'fab',
            'popover',
            'popover-strong',
          ],
        },
      ],
      'bg-image': ['bg-brand-gradient', 'bg-year-progress'],
    },
  },
})

// Concatène des classes conditionnelles puis laisse la dernière gagner en cas de
// conflit Tailwind — indispensable pour qu'une prop `className` surcharge les
// classes de variante d'une primitive.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
