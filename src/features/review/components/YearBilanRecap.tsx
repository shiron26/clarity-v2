import { YearTimeline } from '../../../components/year/YearTimeline'
import { yearRecapDetail, type YearRecap } from '../yearBilanContent'
import type { YearTrack } from '../../../lib/yearTimeline'
import { DeckAction } from '../../../components/ritual/DeckAction'
import { DeckEyebrow } from '../../../components/ritual/DeckEyebrow'

type YearBilanRecapProps = {
  year: number
  recap: YearRecap
  tracks: YearTrack[]
  onNext: () => void
}

/**
 * L'ouverture du bilan annuel — le récit avant le jugement.
 *
 * `DeckRecap` ne convient pas ici, et c'est la seule cérémonie où il ne convient
 * pas : son chiffre est un compteur qui grimpe seul, alors que celui-ci est une
 * **fraction** (« 3 sur 4 »), et il porte en plus la frise de l'année. Un chiffre
 * animé qui monte vers un dénominateur fixe raconterait une course, pas un bilan.
 *
 * La frise est là parce que l'année est un **récit** : un objectif de trois mois
 * n'y est pas un trou, c'est une séquence terminée. La même figure vit sur
 * `/annee`, en page d'archive — ici on la traverse une fois.
 */
export function YearBilanRecap({ year, recap, tracks, onNext }: YearBilanRecapProps) {
  return (
    <>
      <DeckEyebrow className="animate-slide-up">{year} · terminée</DeckEyebrow>

      <p
        className="animate-num-in mt-3.5 text-[72px] leading-[1.05] font-bold lg:mt-4.5 lg:text-[84px]"
        style={{ animationDelay: '0.15s' }}
      >
        <span className="bg-deck-number bg-clip-text text-transparent">
          {recap.done}
        </span>
        {/* Le dénominateur reste gris : il borne, il ne se célèbre pas. Hors du
            dégradé, donc hors du `bg-clip-text` du chiffre. */}
        <span className="text-[34px] text-ink-onnight-faint"> / {recap.total}</span>
      </p>

      <h2
        className="animate-slide-up mt-1 text-[15px] font-semibold text-white lg:text-h1"
        style={{ animationDelay: '0.35s' }}
      >
        {recap.done === 1 ? 'objectif mené au bout' : 'objectifs menés au bout'}
      </h2>

      <p
        className="animate-slide-up mt-2 text-[11px] leading-relaxed text-ink-onnight lg:text-body"
        style={{ animationDelay: '0.55s' }}
      >
        {yearRecapDetail(recap)}
      </p>

      {tracks.length > 0 && (
        <div
          className="animate-slide-up mt-7 w-full rounded-2xl border border-deck-line bg-deck-card p-4"
          style={{ animationDelay: '0.75s' }}
        >
          {/* `now` à `null` : l'année est révolue, il n'y a plus d'« aujourd'hui »
              à marquer dessus. `overview` parce que la colonne d'un deck fait
              430 px — 52 semaines détaillées n'y tiennent pas. */}
          <YearTimeline tracks={tracks} now={null} overview />
        </div>
      )}

      <DeckAction
        onClick={onNext}
        className="mt-7.5"
        delay="0.95s"
      >
        Continuer →
      </DeckAction>
    </>
  )
}
