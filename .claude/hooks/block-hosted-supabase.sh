#!/usr/bin/env bash
# Garde-fou : aucun agent ne touche au Supabase hosted (projet bmmlzydvsfjlfogrgklf).
#
# Le hosted porte des comptes réels. Tests, seeds, resets et « nettoyages » y sont
# interdits — ils s'exécutent contre la stack locale (`npx supabase start`).
# Seul l'utilisateur pousse sur le hosted, à la main.
#
# Branché en PreToolUse/Bash (.claude/settings.json) : reçoit le JSON de l'appel
# d'outil sur stdin, répond `deny` quand la commande vise le hosted.
set -uo pipefail

PROJECT_REF='bmmlzydvsfjlfogrgklf'

cmd=$(jq -r '.tool_input.command // empty')
[ -z "$cmd" ] && exit 0

# Insensible à la casse et aux espaces multiples, pour que les tests restent
# lisibles. Les sauts de ligne sont conservés (pas convertis en espace) : ils
# servent, avec `&&`/`||`/`;`/`|`, à isoler chaque segment de commande.
low=$(printf '%s' "$cmd" | tr 'A-Z' 'a-z' | tr -s ' \t' ' ')

# `--` : les motifs commençant par `--linked` / `--dry-run` ne sont pas des options de grep.
m() { printf '%s' "$low" | grep -qE -- "$1"; }

# Découpe `$low` en segments indépendants sur les séparateurs de commande shell
# (`&&`, `||`, `;`, `|`, saut de ligne). Une exemption (`--dry-run`, `gen types`…)
# ne vaut que pour le segment où elle apparaît, pas pour toute la ligne : sinon
# `supabase db reset --linked && supabase gen types --linked` blanchirait le
# reset parce que `gen types` figure ailleurs sur la même ligne composée.
#
# Pas de retrait de commentaires shell ici, volontairement : un retrait par
# regex ne peut pas distinguer un `#` de commentaire réel d'un `#` littéral à
# l'intérieur d'une chaîne citée sans un vrai analyseur shell. Une première
# version le tentait et effaçait, aux yeux de TOUTES les gardes ci-dessous,
# n'importe quelle commande placée après un `#` cité plus tôt sur la ligne
# (`echo "a #b" && supabase db push --linked` passait alors inaperçu).
# Conséquence acceptée en échange : un vrai `db push` seulement maquillé par
# un commentaire `# --dry-run` en fin de segment reste exempté à tort — un
# contournement bien plus étroit qu'un effacement générique, et le hook n'est
# qu'une des trois couches de défense (AGENTS.md).
segments=()
while IFS= read -r seg; do
  [ -n "$seg" ] && segments+=("$seg")
done < <(printf '%s\n' "$low" | sed -E 's/(&&|\|\||;|\|)/\n/g')
sm() { printf '%s' "$1" | grep -qE -- "$2"; }

deny() {
  jq -nc --arg r "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $r
    }
  }'
  exit 0
}

LOCAL='  → Viser la stack locale : `npx supabase start` puis `npx supabase db reset`.'
ASK='  → Si le hosted est vraiment nécessaire, le dire à l'"'"'utilisateur : lui seul lance la commande.'

# --- 1. Toute référence explicite au projet hosted --------------------------
if m "$PROJECT_REF|supabase\.co(/|\"|'|$| )|\.supabase\.co|supabase\.com"; then
  deny "Commande visant le Supabase hosted (projet $PROJECT_REF) — interdite aux agents : le hosted porte des comptes réels.
$LOCAL
$ASK"
fi

# --- 2. Clé service_role (contourne toutes les RLS) -------------------------
if m 'service_role_key'; then
  deny "Usage de la clé service_role interdit : elle contourne les RLS et sert à créer/supprimer des comptes sur le hosted.
$LOCAL
$ASK"
fi

# --- 3. .env.local = credentials hosted (URL + service_role) ----------------
if m '\.env\.local'; then
  deny ".env.local contient les credentials du Supabase hosted — ne pas le lire ni s'en servir.
  → Pour la config locale : .env.development.local (stack locale) ou .env.example.
$ASK"
fi

# --- 4. CLI supabase sur le projet lié --------------------------------------
for seg in "${segments[@]}"; do
  if sm "$seg" 'supabase .*db push|run db:push( |$)' && ! sm "$seg" '--dry-run|db:push:dry'; then
    deny "\`db push\` applique les migrations sur le hosted — pas de rollback facile, réservé à l'utilisateur.
  → Un agent valide en local : \`npx supabase db reset\`, puis \`npm run db:push:dry\` au plus.
$ASK"
  fi
done

for seg in "${segments[@]}"; do
  if sm "$seg" '--linked' && ! sm "$seg" 'gen types|migration list|db dump|db lint|db diff'; then
    deny "\`--linked\` vise le hosted. Seules les lectures y sont tolérées (gen types, migration list, db dump).
$LOCAL
$ASK"
  fi
done

if m 'supabase (.* )?(un)?link( |$)' || m 'supabase (.* )?projects ' \
  || m 'migration repair' || m 'supabase (.* )?secrets ' || m 'functions deploy'; then
  deny "Commande d'administration du projet hosted — interdite aux agents.
$ASK"
fi

# --- 5. psql / connexions Postgres non locales ------------------------------
if m 'postgres(ql)?://' && ! m '127\.0\.0\.1|localhost'; then
  deny "Connexion Postgres vers un hôte non local — interdite. La base de dev est locale (port 54322).
  → psql \"postgresql://postgres:postgres@127.0.0.1:54322/postgres\" …
$ASK"
fi

if m '\$\{?(db_url|supabase_db_url|database_url)'; then
  deny "\$DB_URL / \$SUPABASE_DB_URL peuvent pointer sur le hosted — cible ambiguë, refusée.
  → Écrire l'URL locale en clair : postgresql://postgres:postgres@127.0.0.1:54322/postgres
$ASK"
fi

# --- 6. smoke test : local uniquement ---------------------------------------
if m 'run smoke|scripts/smoke' && ! m '127\.0\.0\.1|localhost'; then
  deny "\`npm run smoke\` sans SUPABASE_URL explicite lit .env.local → il crée des comptes sur le hosted.
  → SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=\$(npx supabase status -o env | grep ANON_KEY | cut -d= -f2- | tr -d '\"') npm run smoke
$ASK"
fi

exit 0
