#!/usr/bin/env bash
#
# Grant (or revoke) super_admin to one or more users by email.
#
#   scripts/set-superadmin.sh a@x.com b@y.com            # grant on STAGING (default)
#   scripts/set-superadmin.sh --revoke a@x.com           # revoke on staging
#   scripts/set-superadmin.sh --env production a@x.com   # PRODUCTION (guarded)
#
# Super_admin is stored as auth.users.raw_user_meta_data->>'role' = 'super_admin'.
# RLS reads it via is_super_admin() (see supabase/migrations/00002_rls_policies.sql)
# and the API auth middleware reads user_metadata.role. Nothing else defines it.
#
# Uses `supabase db query --linked`, so the LINKED project ref must match the
# target env. The script verifies supabase/.temp/project-ref before writing.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

STAGING_REF="vwrsqdfunxmjjtebyxdf"
PROD_REF="xewiqmxzhxlhmgspairk"

ENVIRONMENT="staging"
ACTION="grant"
EMAILS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)     ENVIRONMENT="${2:-}"; shift 2 ;;
    --revoke)  ACTION="revoke"; shift ;;
    --grant)   ACTION="grant"; shift ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*)  echo "unknown flag: $1" >&2; exit 1 ;;
    *)   EMAILS+=("$1"); shift ;;
  esac
done

if [[ ${#EMAILS[@]} -eq 0 ]]; then
  echo "usage: $0 [--env staging|production] [--revoke] <email> [email...]" >&2
  exit 1
fi

case "$ENVIRONMENT" in
  staging)    TARGET_REF="$STAGING_REF" ;;
  production) TARGET_REF="$PROD_REF" ;;
  *) echo "error: --env must be staging|production" >&2; exit 1 ;;
esac

# Verify the linked ref matches the intended env (no accidental prod writes).
LINKED_REF="$(cat "$REPO_ROOT/supabase/.temp/project-ref" 2>/dev/null || true)"
if [[ "$LINKED_REF" != "$TARGET_REF" ]]; then
  echo "error: linked ref is '$LINKED_REF' but --env $ENVIRONMENT expects '$TARGET_REF'." >&2
  echo "       run: supabase link --project-ref $TARGET_REF" >&2
  exit 1
fi

# Build a SQL email list: 'a@x.com','b@y.com'  (single quotes escaped for SQL).
SQL_LIST=""
for e in "${EMAILS[@]}"; do
  esc="${e//\'/\'\'}"
  SQL_LIST+="${SQL_LIST:+,}'$esc'"
done

if [[ "$ACTION" == "grant" ]]; then
  SET_CLAUSE="raw_user_meta_data = coalesce(raw_user_meta_data,'{}'::jsonb) || jsonb_build_object('role','super_admin')"
else
  SET_CLAUSE="raw_user_meta_data = raw_user_meta_data - 'role'"
fi

echo "── set-superadmin ────────────────────────────────────"
echo "  action      : $ACTION"
echo "  environment : $ENVIRONMENT ($TARGET_REF)"
echo "  emails      : ${EMAILS[*]}"
echo "──────────────────────────────────────────────────────"

if [[ "$ENVIRONMENT" == "production" ]]; then
  read -r -p "This targets PRODUCTION ($TARGET_REF). Type the ref to continue: " CONFIRM
  [[ "$CONFIRM" == "$TARGET_REF" ]] || { echo "aborted." >&2; exit 1; }
fi

supabase db query \
  "UPDATE auth.users SET $SET_CLAUSE WHERE email IN ($SQL_LIST) RETURNING email, raw_user_meta_data->>'role' AS role;" \
  --linked
