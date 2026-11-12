import { describe, expect, it } from 'vitest'
import { dataErrorMessage } from './errorMessage'
import { DEFAULT_NOTIFICATION_PATH, safeNotificationPath } from './pushMessages'
import { daySections, isDueOn, isPastDue } from './taskDay'
import type { Task } from '../hooks/useTasks'
import { smsLink, whatsappLink } from './messageLinks'

// « Ma journée » : les fonctions pures côté client. Le reste (ingestion, résumé,
// 29 février) se teste en SQL, dans supabase/tests/04_ma_journee.sql.

describe('daySections — les tâches de « Ma journée »', () => {
  const today = '2026-11-12'
  let n = 0
  const t = (due_date: string | null, completed_at: string | null = null, position = 0): Task => ({
    id: `t${++n}`,
    user_id: 'u',
    space_id: null,
    list_id: null,
    objective_id: null,
    title: `Tâche ${n}`,
    description: null,
    due_date,
    is_important: false,
    position,
    recurrence: null,
    completed_at,
    created_at: null,
  })

  it('range chaque tâche dans son bloc, et ignore le reste', () => {
    const todayOpen = t('2026-11-12')
    const todayDone = t('2026-11-12', '2026-11-12T08:00:00Z')
    const late = t('2026-11-10')
    const sections = daySections([todayOpen, todayDone, late, t('2026-11-13'), t(null)], today)
    expect(sections.dueToday).toEqual([todayOpen, todayDone])
    expect(sections.overdue).toEqual([late])
    expect(sections.pending).toBe(2)
  })

  it('garde en retard une tâche cochée aujourd’hui : c’est le bilan du jour', () => {
    const late = t('2026-11-11', '2026-11-12T09:00:00Z')
    expect(daySections([late], today)).toEqual({ overdue: [late], dueToday: [], pending: 0 })
  })

  it('trie comme /taches : retard par échéance, puis ordre manuel', () => {
    const a = t('2026-11-12', null, 2)
    const b = t('2026-11-12', null, 1)
    const older = t('2026-11-01', null, 9)
    const recent = t('2026-11-10', null, 0)
    const sections = daySections([a, recent, b, older], today)
    expect(sections.dueToday).toEqual([b, a])
    expect(sections.overdue).toEqual([older, recent])
  })

  it('compare des dates, pas des instants', () => {
    expect(isDueOn(t('2026-11-12'), today)).toBe(true)
    expect(isPastDue(t('2026-11-12'), today)).toBe(false)
    expect(isPastDue(t(null), today)).toBe(false)
  })
})

describe('whatsappLink', () => {
  it('encode le message entier, emoji compris', () => {
    expect(whatsappLink('33612345678', 'Joyeux anniversaire Marie ! 🎉 & bises')).toBe(
      'https://wa.me/33612345678?text=Joyeux%20anniversaire%20Marie%20!%20%F0%9F%8E%89%20%26%20bises',
    )
  })

  it('refuse un numéro qui n’est pas fait de 8 à 15 chiffres', () => {
    expect(whatsappLink('+33612345678', 'x')).toBeNull()
    expect(whatsappLink('0612', 'x')).toBeNull()
    expect(whatsappLink(null, 'x')).toBeNull()
    expect(whatsappLink('336123/../x', 'x')).toBeNull()
  })

  it('ouvre la conversation sans texte quand le message est vide', () => {
    expect(whatsappLink('33612345678', '  ')).toBe('https://wa.me/33612345678')
  })
})

describe('smsLink', () => {
  it('ouvre la messagerie du téléphone, numéro international et message encodé', () => {
    expect(smsLink('33612345678', 'Joyeux anniversaire Marie ! 🎉')).toBe(
      'sms:+33612345678?&body=Joyeux%20anniversaire%20Marie%20!%20%F0%9F%8E%89',
    )
  })

  it('applique la même garde que WhatsApp sur le numéro', () => {
    expect(smsLink('+33612345678', 'x')).toBeNull()
    expect(smsLink(null, 'x')).toBeNull()
    expect(smsLink('33612345678', ' ')).toBe('sms:+33612345678')
  })
})

describe('safeNotificationPath', () => {
  it('garde un chemin interne', () => {
    expect(safeNotificationPath('/ma-journee')).toBe('/ma-journee')
    expect(safeNotificationPath('/taches?vue=aujourdhui')).toBe('/taches?vue=aujourdhui')
  })

  it('refuse tout ce qui sortirait de l’app', () => {
    for (const value of ['https://evil.test', '//evil.test', '/\\evil.test', 'javascript:alert(1)', '', 42, null]) {
      expect(safeNotificationPath(value)).toBe(DEFAULT_NOTIFICATION_PATH)
    }
  })
})

describe('dataErrorMessage — règles « Ma journée »', () => {
  // Intestables en E2E : l'interface garde en amont (bouton de jeton désactivé à
  // trois, numéro validé avant envoi). La copie se vérifie donc ici.
  const p0001 = (message: string) => ({ code: 'P0001', message, details: null, hint: null })

  it.each([
    ['ingest_token_cap', 'Trois jetons actifs'],
    ['push_subscription_cap', 'Dix appareils'],
    ['birthday_not_manual', 'vient de Google'],
    ['birthday_phone_invalid', 'format international'],
    ['digest_template_too_long', '500 caractères'],
  ])('%s a sa copie', (rule, excerpt) => {
    expect(dataErrorMessage(p0001(rule))).toContain(excerpt)
  })

  it('aucune copie ne porte de tiret cadratin', () => {
    for (const rule of ['ingest_token_cap', 'push_endpoint_invalid', 'push_subscription_cap',
      'digest_template_too_long', 'birthday_not_manual', 'birthday_name_required',
      'birthday_date_invalid', 'birthday_phone_invalid']) {
      expect(dataErrorMessage(p0001(rule))).not.toContain('—')
    }
  })
})
