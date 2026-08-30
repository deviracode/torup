/**
 * One-time backfill: submit the app's required WhatsApp message templates
 * (see services/whatsapp-templates.ts) to every business that connected
 * WhatsApp *before* automatic provisioning was wired into the connect flow
 * (see whatsapp-credentials.service.ts `save()`).
 *
 * Safe to re-run — submitting a template that already exists is treated as
 * success, not an error.
 *
 * Usage:
 *   cd apps/api && SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/backfill-whatsapp-templates.ts
 *
 * Respects whatever SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are in the
 * environment — verify these point at the intended project before running,
 * per docs/ENVIRONMENTS.md.
 */
import { createServiceClient } from "../src/lib/supabase";
import { createWhatsAppCredentialsRepo } from "../src/modules/whatsapp/whatsapp-credentials.repository";
import { provisionTemplates } from "../src/services/whatsapp-templates";

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL ?? "(unset)";
  console.log(`[backfill] Target Supabase project: ${supabaseUrl}`);

  const repo = createWhatsAppCredentialsRepo(createServiceClient());
  const { data: credentials, error } = await repo.listAllActive();
  if (error) {
    console.error("[backfill] Failed to list WhatsApp credentials:", error);
    process.exit(1);
  }

  console.log(`[backfill] Found ${credentials.length} active WhatsApp connection(s)`);

  let ok = 0;
  let skipped = 0;
  for (const cred of credentials) {
    if (!cred || !cred.access_token || !cred.phone_number_id) {
      skipped += 1;
      continue;
    }
    const { wabaId, results } = await provisionTemplates({
      phoneNumberId: cred.phone_number_id,
      accessToken: cred.access_token,
    });
    if (!wabaId) {
      console.error(`[backfill] business ${cred.business_id}: could not resolve WABA id — skipping`);
      skipped += 1;
      continue;
    }
    console.log(
      `[backfill] business ${cred.business_id} (waba ${wabaId}): ` +
      results.map((r) => `${r.name}=${r.status}`).join(", ")
    );
    ok += 1;
  }

  console.log(`[backfill] Done — processed ${ok}, skipped ${skipped} of ${credentials.length}`);
}

main().catch((err) => {
  console.error("[backfill] Fatal error:", err);
  process.exit(1);
});
