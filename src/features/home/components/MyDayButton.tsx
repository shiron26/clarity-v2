import { Link } from 'react-router'
import { SunIcon } from '../../../components/icons/SunIcon'
import { useAppToday } from '../../../hooks/useAppToday'
import { useDigestSettings } from '../../../hooks/useDigestSettings'
import { cn } from '../../../lib/cn'

/**
 * L'accès à « Ma journée » depuis l'accueil, épinglé au-dessus des objectifs.
 *
 * Coloré tant que la journée n'a pas été ouverte, éteint ensuite : c'est une
 * invitation du matin, pas un élément de décor. La consultation est datée par le
 * serveur (`mark_my_day_viewed`), donc l'ouvrir sur le téléphone éteint aussi le
 * bouton de l'ordinateur.
 *
 * Tant que la date ou les réglages chargent, le bouton reste éteint : mieux vaut
 * une invitation qui s'allume qu'une invitation qui clignote.
 */
export function MyDayButton() {
  const today = useAppToday().data
  const settings = useDigestSettings().data
  const unseen = !!today && !!settings && settings.last_viewed_on !== today

  return (
    <Link
      to="/ma-journee"
      className={cn(
        'group flex items-center gap-3.5 rounded-2xl px-5 py-4 transition-[background-color,box-shadow,color] duration-500',
        'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
        unseen
          ? 'bg-brand-gradient text-white shadow-[0_8px_24px_-8px_rgba(26,102,255,0.55)]'
          : 'bg-surface text-ink shadow-card hover:bg-surface-sidebar',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full transition-colors duration-500',
          unseen ? 'bg-white/18 text-white' : 'bg-surface-subtle text-ink-muted',
        )}
      >
        <SunIcon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-card font-semibold">Ma journée</span>
        <span className={cn('truncate text-label', unseen ? 'text-white/85' : 'text-ink-muted')}>
          {unseen ? 'Votre résumé du jour vous attend' : 'Déjà consultée aujourd’hui'}
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          'text-[22px] leading-none transition-transform duration-200 group-hover:translate-x-0.5',
          unseen ? 'text-white' : 'text-ink-muted',
        )}
      >
        ›
      </span>
    </Link>
  )
}
