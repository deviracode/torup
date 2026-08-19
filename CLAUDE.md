# CLAUDE.md

Project guidance for Claude Code.

## Environments (Supabase + Railway)

**Read [`docs/ENVIRONMENTS.md`](docs/ENVIRONMENTS.md) before running any Supabase or Railway CLI command.** It documents staging vs production identifiers, how to switch, and the exact CLI commands per platform/env.

### Golden rule
Never run a mutating command against **production**. Default working target is **staging**.

- **Supabase staging** = `vwrsqdfunxmjjtebyxdf` (Torup `staging` branch) — local target.
- **Supabase production** = `xewiqmxzhxlhmgspairk` (Torup `main`) — **OFF-LIMITS**.
- **Railway** project `torup-v2`; use `-e staging` on commands; production env is off-limits.

### Before any mutating command, verify the target
```bash
cat supabase/.temp/project-ref                     # must be vwrsqdfunxmjjtebyxdf (staging)
railway status | grep -E 'Project:|Environment:'   # must be Environment: staging
```

For migrations, switching envs, setting Railway vars, and redeploys, see the full command reference in `docs/ENVIRONMENTS.md`.
