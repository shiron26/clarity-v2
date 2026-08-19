import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { LOCAL_DB_CONTAINER } from '../local'

const run = promisify(execFile)

/**
 * SQL direct sur la base LOCALE, réservé aux préconditions temporelles.
 *
 * POURQUOI CE HELPER EXISTE
 * -------------------------
 * Un rituel hebdomadaire s'ouvre le vendredi 18 h (`public.review_openings`), donc
 * toute semaine révolue est ouverte. Mais l'écran exige EN PLUS que l'objectif ait
 * existé pendant cette semaine — `ReviewPage` filtre sur
 * `objective.created_at <= dimanche de la semaine`. Or `created_at` est posé par le
 * serveur (`default now()`) : un test qui crée son objectif aujourd'hui ne peut donc
 * ouvrir que la semaine EN COURS, laquelle n'est ouverte qu'à partir du vendredi soir.
 * Sans antidatage, le parcours ne serait jouable que du vendredi 18 h au dimanche —
 * inutilisable en intégration continue.
 *
 * CE QU'IL S'AUTORISE, ET RIEN DE PLUS
 * ------------------------------------
 * Fabriquer des préconditions que l'API ne permet pas de poser. JAMAIS vérifier un
 * résultat : une assertion passe toujours par l'interface, sinon le test ne teste plus
 * le produit mais la base.
 *
 * POURQUOI C'EST LÉGITIME ICI
 * ---------------------------
 * AGENTS.md autorise explicitement psql sur la stack locale et n'interdit que le projet
 * hosted et la clé `service_role`. Ce helper n'utilise ni l'un ni l'autre : il passe par
 * `docker exec` sur le conteneur de la stack locale, ce qui marche à l'identique sur un
 * poste et sur un runner GitHub, sans installer de client Postgres.
 */

const CONTENEUR_ATTENDU = 'supabase_db_clarity-v2'

// Échec fermé, au chargement du module : le helper ne peut pas être détourné vers une
// autre base en changeant une constante.
if (LOCAL_DB_CONTAINER !== CONTENEUR_ATTENDU) {
  throw new Error(
    `Le helper SQL ne parle qu'au conteneur local « ${CONTENEUR_ATTENDU} ». ` +
      `Valeur reçue : « ${LOCAL_DB_CONTAINER} ».`,
  )
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/

async function psql(sql: string): Promise<void> {
  await run('docker', [
    'exec',
    LOCAL_DB_CONTAINER,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    sql,
  ])
}

/**
 * Recule la date de création d'un objectif, pour qu'il « existe » lors d'une semaine
 * passée. Les deux arguments sont validés par forme : ils entrent dans une chaîne SQL,
 * et un helper de test n'est pas une raison d'écrire une injection.
 */
export async function antidaterObjectif(objectifId: string, jour: string): Promise<void> {
  if (!UUID.test(objectifId)) throw new Error(`Identifiant d'objectif invalide : ${objectifId}`)
  if (!DATE_ISO.test(jour)) throw new Error(`Date invalide : ${jour}`)

  await psql(
    `update private.objective set created_at = timestamptz '${jour} 09:00:00+00' where id = '${objectifId}';`,
  )
}
