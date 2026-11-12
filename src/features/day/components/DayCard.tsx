import type { ReactNode } from 'react'
import { Card } from '../../../components/ui/Card'
import { CardHeader } from '../../../components/ui/CardHeader'

/**
 * La carte des écrans « Ma journée » et de ses réglages : la coquille du design
 * system (`Card`) et l'en-tête des widgets de l'accueil (`CardHeader`), pour que
 * les deux écrans se lisent comme le dashboard. Sans le plafond de hauteur ni le
 * défilement interne de `WidgetCard`, qui ne valent que dans une grille.
 */
export function DayCard({
  title,
  icon,
  meta,
  children,
}: {
  title: string
  icon: ReactNode
  meta?: ReactNode
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader title={title} icon={icon} meta={meta} />
      {children}
    </Card>
  )
}
