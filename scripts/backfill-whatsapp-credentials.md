# Backfill: seed WhatsApp credentials for existing tenants

After the BYO WhatsApp migration, tenants cannot send until they connect a number.
To keep a currently-live tenant working at cutover, insert its credentials once,
using the values that previously lived in the platform env (`WHATSAPP_PHONE_NUMBER_ID`,
`WHATSAPP_TOKEN`):

```sql
INSERT INTO whatsapp_credentials (business_id, phone_number_id, access_token, display_phone, verified_at)
VALUES ('<business-uuid>', '<phone_number_id>', '<permanent_access_token>', '<+972...>', now())
ON CONFLICT (business_id) DO UPDATE
  SET phone_number_id = EXCLUDED.phone_number_id,
      access_token    = EXCLUDED.access_token,
      display_phone   = EXCLUDED.display_phone,
      updated_at      = now();
```

Run via the Supabase SQL editor (service role). All other tenants onboard via the
dashboard settings screen.
