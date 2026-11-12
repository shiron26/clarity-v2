// Les liens « Lui écrire » d'un anniversaire (SPEC-MA-JOURNEE D10).
//
// Construits côté client : Clarity n'envoie jamais rien à un tiers. Le lien ouvre
// l'app choisie avec le message déjà rédigé, et c'est l'utilisateur qui l'envoie.
//
// Le serveur ne stocke que des chiffres (format international sans « + »), mais la
// valeur traverse le réseau : chaque fonction la revérifie avant d'en faire une URL.

const PHONE = /^\d{8,15}$/

/** `https://wa.me/<chiffres>?text=<message>`, ou `null` sans numéro exploitable. */
export function whatsappLink(phone: string | null | undefined, message: string): string | null {
  if (!phone || !PHONE.test(phone)) return null
  const text = message.trim()
  return text
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${phone}`
}

/**
 * L'app de messagerie du téléphone (iMessage / SMS sur iPhone, Messages sur
 * Android), ou `null` sans numéro exploitable.
 *
 * `?&body=` n'est pas une coquille : iOS lit le corps après `&`, Android après
 * `?`, et la forme combinée est la seule que les deux comprennent.
 */
export function smsLink(phone: string | null | undefined, message: string): string | null {
  if (!phone || !PHONE.test(phone)) return null
  const text = message.trim()
  return text ? `sms:+${phone}?&body=${encodeURIComponent(text)}` : `sms:+${phone}`
}
