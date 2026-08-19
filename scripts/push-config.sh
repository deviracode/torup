#!/usr/bin/env bash
#
# Push Supabase auth/config to a specific environment.
#
#   scripts/push-config.sh staging       # push to Torup `staging` branch
#   scripts/push-config.sh production     # push to Torup `main`   (guarded)
#
# Reads packages/db/supabase/.env.<env> for PROJECT_REF + the SUPABASE_AUTH_*
# values that config.toml interpolates via env(). Nothing is pushed until you
# confirm the target ref shown in the plan.
#
set -euo pipefail

ENVIRONMENT="${1:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_DIR="$REPO_ROOT/packages/db/supabase"

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo "usage: $0 <staging|production>" >&2
  exit 1
fi

ENV_FILE="$DB_DIR/.env.$ENVIRONMENT"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: $ENV_FILE not found (copy .env.$ENVIRONMENT.example and fill it in)" >&2
  exit 1
fi

# Load the env file (export every assignment for env() interpolation).
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${PROJECT_REF:-}" ]]; then
  echo "error: PROJECT_REF not set in $ENV_FILE" >&2
  exit 1
fi

echo "── Supabase config push ──────────────────────────────"
echo "  environment : $ENVIRONMENT"
echo "  project ref : $PROJECT_REF"
echo "  site_url    : ${SUPABASE_AUTH_SITE_URL:-<unset>}"
echo "──────────────────────────────────────────────────────"

# Extra guard: production is off-limits by default.
if [[ "$ENVIRONMENT" == "production" ]]; then
  read -r -p "This targets PRODUCTION ($PROJECT_REF). Type the ref to continue: " CONFIRM
  if [[ "$CONFIRM" != "$PROJECT_REF" ]]; then
    echo "aborted." >&2
    exit 1
  fi
fi

# --yes: the script already confirmed intent above (prod requires typing the ref).
# Without it, config push waits on an interactive [Y/n] that gets empty stdin here.
supabase config push --project-ref "$PROJECT_REF" --workdir "$DB_DIR" --yes
