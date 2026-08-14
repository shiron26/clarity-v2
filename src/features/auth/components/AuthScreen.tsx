import type { ReactNode } from 'react'
import { cn } from '../../../lib/cn'

type AuthScreenProps = {
  children: ReactNode
  /** Panneau latéral illustratif, affiché à partir de lg. */
  aside?: ReactNode
  asideSide?: 'left' | 'right'
  /** Fond du panneau latéral (bg-night côté connexion, bg-primary côté inscription). */
  asideClassName?: string
  /** Bandeau condensé rendu au-dessus du formulaire sur petit écran. */
  mobileBanner?: ReactNode
  className?: string
}

// Écran d'auth plein cadre : deux colonnes 50/50 à partir de lg (formulaire +
// panneau illustratif), empilées en mobile. Le contenu de chaque colonne est
// borné et centré pour que la ligne de texte reste lisible sur grand écran.
export function AuthScreen({
  children,
  aside,
  asideSide = 'right',
  asideClassName,
  mobileBanner,
  className,
}: AuthScreenProps) {
  const panel = aside && (
    <aside
      aria-hidden="true"
      className={cn(
        'hidden shrink-0 basis-1/2 flex-col justify-center px-10 py-14 lg:flex',
        asideSide === 'left' ? 'order-first' : 'order-last',
        asideClassName,
      )}
    >
      <div className="mx-auto w-full max-w-[440px]">{aside}</div>
    </aside>
  )

  return (
    <div className={cn('flex min-h-dvh flex-col bg-auth-canvas lg:flex-row', className)}>
      {mobileBanner && <div className="lg:hidden">{mobileBanner}</div>}
      {panel}
      <main
        className={cn(
          'flex shrink-0 basis-full flex-col justify-center px-6 py-10 lg:px-10',
          // sans panneau (écran « vérifie tes emails »), le formulaire occupe tout
          panel ? 'lg:basis-1/2' : 'lg:basis-full',
        )}
      >
        <div className="mx-auto w-full max-w-[440px]">{children}</div>
      </main>
    </div>
  )
}
