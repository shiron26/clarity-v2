// « Il y a 12 min » : l'ancienneté d'un instant passé, pour les écrans de réglages
// (dernière synchro, dernier envoi).
//
// C'est un ÉCART entre deux instants, pas une date du calendrier : l'horloge de
// l'appareil suffit, le fuseau de l'application n'y joue aucun rôle. Au-delà d'une
// semaine, l'écart ne dit plus rien et laisse la place à la date.

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

export function formatAgo(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  if (diff < MINUTE) return 'à l’instant'
  if (diff < HOUR) return `il y a ${Math.floor(diff / MINUTE)} min`
  if (diff < DAY) return `il y a ${Math.floor(diff / HOUR)} h`
  if (diff < 2 * DAY) return 'hier'
  if (diff < 7 * DAY) return `il y a ${Math.floor(diff / DAY)} jours`
  return `le ${dateFormat.format(new Date(iso))}`
}
