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
 *   # scope to one business:
 *   ... npx tsx scripts/backfill-whatsapp-templates.ts --business-id <uuid>
 *   ... npx tsx scripts/backfill-whatsapp-templates.ts --business-name "Somar Eyebrow Art"
 *
 * Respects whatever SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are in the
 * environment — verify these point at the intended project before running,
 * per docs/ENVIRONMENTS.md.
 */
import { createServiceClient } from "../src/lib/supabase";
import { createWhatsAppCredentialsRepo } from "../src/modules/whatsapp/whatsapp-credentials.repository";
import { provisionTemplates } from "../src/services/whatsapp-templates";

function parseArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || !process.argv[idx + 1]) return null;
  return process.argv[idx + 1];
}

async function resolveBusinessIdByName(name: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, name")
    .ilike("name", `%${name}%`);
  if (error) {
    console.error("[backfill] Failed to look up business by name:", error);
    return null;
  }
  if (!data || data.length === 0) {
    console.error(`[backfill] No business found matching name "${name}"`);
    return null;
  }
  if (data.length > 1) {
    console.error(
      `[backfill] Multiple businesses match "${name}" — use --business-id instead:\n` +
      data.map((b) => `  ${b.id}  ${b.name}`).join("\n")
    );
    return null;
  }
  console.log(`[backfill] Resolved "${name}" -> business ${data[0].id} (${data[0].name})`);
  return data[0].id;
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL ?? "(unset)";
  console.log(`[backfill] Target Supabase project: ${supabaseUrl}`);

  const businessNameFilter = parseArg("--business-name");
  let businessIdFilter = parseArg("--business-id");

  if (businessNameFilter && businessIdFilter) {
    console.error("[backfill] Pass either --business-id or --business-name, not both");
    process.exit(1);
  }
  if (businessNameFilter) {
    businessIdFilter = await resolveBusinessIdByName(businessNameFilter);
    if (!businessIdFilter) process.exit(1);
  }
  if (businessIdFilter) {
    console.log(`[backfill] Scoped to business ${businessIdFilter}`);
  }

  const repo = createWhatsAppCredentialsRepo(createServiceClient());
  const { data: allCredentials, error } = await repo.listAllActive();
  if (error) {
    console.error("[backfill] Failed to list WhatsApp credentials:", error);
    process.exit(1);
  }

  const credentials = businessIdFilter
    ? allCredentials.filter((c) => c?.business_id === businessIdFilter)
    : allCredentials;

  if (businessIdFilter && credentials.length === 0) {
    console.error(`[backfill] No active WhatsApp connection found for business ${businessIdFilter}`);
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
