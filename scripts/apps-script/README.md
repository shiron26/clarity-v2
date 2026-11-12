# Collecteur Google de « Ma journée »

`Code.gs` + `appsscript.json` : à coller dans un projet [script.google.com](https://script.google.com),
**un par compte Google**. Le script lit Gmail, Agenda et Contacts du compte qui l'exécute
et envoie chaque heure un instantané à la RPC `ingest_daily_snapshot` (SPEC-MA-JOURNEE §4.1).

Ces fichiers ne sont pas exécutés par le dépôt : ils sont versionnés pour que le contrat
d'ingestion et son client évoluent ensemble. Toute modification se recolle à la main.

## Installation (SPEC §8)

1. Clarity → **Ma journée → Réglages → Générer un jeton**. Le copier : il n'est affiché qu'une fois.
2. script.google.com → nouveau projet (avec le bon compte Google) → coller `Code.gs`.
3. Paramètres du projet → cocher « Afficher le fichier manifeste appsscript.json » → remplacer
   son contenu par `appsscript.json` (fuseau Europe/Paris + service avancé People API).
4. Paramètres du projet → **propriétés de script** :
   - `CLARITY_SUPABASE_URL` : `https://<ref>.supabase.co`
   - `CLARITY_PUBLIC_KEY` : la clé publique Supabase (publishable ou anon)
   - `CLARITY_INGEST_TOKEN` : le jeton de l'étape 1
5. Exécuter `previewPayload` : accepter les autorisations, vérifier le payload dans les journaux.
6. Exécuter `setup` : déclencheur horaire + première synchro.

## Tester contre la stack LOCALE

Le script tourne sur les serveurs de Google, qui ne voient pas `127.0.0.1`. Pour le brancher
sur la stack locale (données de test, aucun compte réel) :

```sh
npx supabase start
cloudflared tunnel --url http://127.0.0.1:54321   # ou : ngrok http 54321
```

Puis, dans les propriétés du script :
- `CLARITY_SUPABASE_URL` = l'URL `https://….trycloudflare.com` affichée par le tunnel ;
- `CLARITY_PUBLIC_KEY` = la clé anon locale (`npx supabase status -o env`, `ANON_KEY`) ;
- `CLARITY_INGEST_TOKEN` = un jeton généré depuis l'app **lancée en local**.

Fermer le tunnel après le test : tant qu'il tourne, l'API locale est joignable depuis Internet.

## Ce que la RPC refuse

Tout le payload est rejeté (`invalid_payload: <règle>`) si : `version ≠ 1`, fenêtre vide ou
de plus de 3 jours, plus de 200 événements / 50 mails / 2 000 anniversaires, date illisible,
`source` autre que `contacts` / `calendar`. Un téléphone hors `^\d{8,15}$` devient `null`
sans rejet, un permalien qui n'est pas `https://mail.google.com/…` aussi. Un jeton inconnu,
révoqué ou d'un compte supprimé répond `invalid token`, sans préciser.
