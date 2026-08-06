# Backfill: seed & encrypt WhatsApp credentials for existing tenants

Every WhatsApp secret (`access_token`, `app_secret`, `verify_token`) is per-tenant
— each tenant registers their own Meta App — and is encrypted at rest with a
single platform `ENCRYPTION_KEY` (AES-256-GCM, see `@torup/shared` crypto). SQL
inserts below use plaintext placeholders for readability; in practice, write
credentials through the dashboard (`PUT /api/businesses/:businessId/whatsapp`)
or the Node script below so encryption happens automatically — don't insert
plaintext secrets directly via SQL in a real environment.

## 1. Generate and set ENCRYPTION_KEY

```bash
openssl rand -base64 32
```

Set the result as `ENCRYPTION_KEY` in both `apps/api` and `services/whatsapp-agent`
deploy environments (Railway dashboard). Both services must use the **same** key.

## 2. Seed a tenant's credentials

Preferred: use the dashboard settings screen (`WhatsAppSettings` component) — it
encrypts on save via the API route. Each tenant needs, from their own Meta App:

- `phoneNumberId` — WhatsApp Business phone number ID
- `accessToken` — permanent access token
- `appSecret` — from Meta App settings (used for webhook signature verification)
- `verifyToken` — a secret string you choose; configure the same value in the
  tenant's Meta App webhook subscription

The tenant's webhook URL to register with Meta is:
```
https://<api-host>/api/webhooks/whatsapp/<businessId>
```

## 3. One-off script alternative (bulk seed)

For bulk seeding at cutover, run a small Node script using the same encrypt
helper the app uses, so rows land encrypted:

```ts
import { createClient } from "@torup/db";
import { encrypt } from "@torup/shared";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

await supabase.from("whatsapp_credentials").upsert(
  {
    business_id: "<business-uuid>",
    phone_number_id: "<phone_number_id>",
    access_token: encrypt("<permanent_access_token>"),
    app_secret: encrypt("<app_secret>"),
    verify_token: encrypt("<verify_token>"),
    display_phone: "<+972...>",
    verified_at: new Date().toISOString(),
  },
  { onConflict: "business_id" }
);
```

Run with `ENCRYPTION_KEY` set in the environment.

## 4. Migrating legacy plaintext rows

Rows written before encryption-at-rest shipped have plaintext `access_token`
values. The repository read path (`whatsapp-credentials.repository.ts`,
`credentials.ts`) already tolerates this via `isEncrypted()` — no immediate
action required. To re-encrypt them in place (idempotent, safe to re-run):

```ts
import { createClient } from "@torup/db";
import { encrypt, isEncrypted } from "@torup/shared";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data: rows } = await supabase.from("whatsapp_credentials").select("*");

for (const row of rows ?? []) {
  const patch: Record<string, string> = {};
  if (row.access_token && !isEncrypted(row.access_token)) patch.access_token = encrypt(row.access_token);
  if (row.app_secret && !isEncrypted(row.app_secret)) patch.app_secret = encrypt(row.app_secret);
  if (row.verify_token && !isEncrypted(row.verify_token)) patch.verify_token = encrypt(row.verify_token);
  if (Object.keys(patch).length > 0) {
    await supabase.from("whatsapp_credentials").update(patch).eq("id", row.id);
  }
}
```

## 5. Rotate previously-committed secrets

`services/whatsapp-agent/.env.example` and `apps/api/.env.example` previously
contained real-looking WhatsApp secret values committed to git history. Those
values must be treated as compromised: **rotate them in Meta** (regenerate the
access token, app secret, and change the verify token) even though the files
have since been scrubbed to placeholders — removing them from the working tree
does not remove them from git history.
