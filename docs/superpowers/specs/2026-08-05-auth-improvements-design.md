# Auth Improvements — Design Spec

**Date:** 2026-08-05
**Status:** approved

## Overview

Five improvements to the authentication system:

1. **PKCE fix** — Password reset links fail with "PKCE code verifier not found"
2. **Don't overwrite existing passwords** — Admin onboarding resets existing user passwords
3. **Hebrew error messages** — Auth pages display raw English errors
4. **Resend confirmation email** — No way to resend signup confirmation from login page
5. **2FA PIN via email** — Add email-based second factor for all users

---

## Section 1: PKCE Fix — Server-Side Code Exchange

### Problem

`resetPasswordForEmail` generates a PKCE code verifier client-side (stored in localStorage/cookies by `@supabase/ssr`). When the email link is clicked, `exchangeCodeForSession` on the reset-password page can't find the verifier — fails in private browsing, mobile in-app browsers, or any browser context mismatch.

### Solution

Handle the PKCE code exchange **server-side in middleware**, matching the pattern already used by `/auth/callback/route.ts`.

### Changes

**`apps/web/src/middleware.ts`** — Add before existing route logic:

- Detect requests to any path containing `/reset-password` with a `?code=` query parameter
- Exchange the code for a session using the server-side Supabase client (cookie-based)
- On success: redirect to the same path without `?code=` — session cookie is now set
- On failure: redirect to login with `?error=reset_link_expired`

**`apps/web/src/app/[locale]/(auth)/reset-password/page.tsx`** — Simplify:

- Remove the `useEffect` that calls `exchangeCodeForSession` and `setSession`
- Replace with a check: read session from the server-set cookie (via `supabase.auth.getSession()`)
- If no session: show "Invalid or expired link" with link back to forgot-password
- If session exists: show the new-password form (existing UI)

### No API changes needed

---

## Section 2: Admin Onboarding — Don't Reset Existing Passwords

### Problem

When `POST /api/admin/businesses` includes an `owner_email` matching an existing Supabase user, `admin.service.ts:43` calls `updateUserById(existing.id, { password: tempPw })` — silently overwriting the user's password.

### Solution

If the user already exists, skip password modification entirely. Only create the membership.

### Changes

**`apps/api/src/modules/admin/admin.service.ts`** — `onboard()` method:

- Lines 41-43: Replace `updateUserById` call with a no-op for existing users
- Return `user_already_exists: true` instead of `temp_password` when user existed
- For new users: keep existing behavior (create user + temp password)

**Frontend (admin panel)** — Handle the new response field:

- If `user_already_exists === true`: show "Business created. Owner account already exists."
- If `temp_password` present: show "Credentials: email / temp password" (existing behavior)

---

## Section 3: Hebrew Error Messages on Auth Pages

### Problem

All auth pages (login, register, forgot-password, reset-password) display raw English Supabase error messages. The i18n translations exist but are unused for runtime errors.

### Solution

Client-side error mapping: translate known Supabase error messages to Hebrew using the existing `next-intl` setup.

### Changes

**`packages/i18n/messages/he.json`** — Add `authErrors` namespace with key mappings:

```json
{
  "authErrors": {
    "invalidCredentials": "פרטי התחברות שגויים",
    "emailNotConfirmed": "האימייל לא אומת. בדוק את תיבת הדואר שלך",
    "rateLimitExceeded": "נסה שוב בעוד מספר דקות",
    "userAlreadyExists": "משתמש עם אימייל זה כבר רשום",
    "invalidEmail": "כתובת אימייל לא תקינה",
    "weakPassword": "הסיסמה חייבת להכיל לפחות 6 תווים",
    "expiredLink": "הקישור פג תוקף, בקש קישור חדש",
    "default": "אירעה שגיאה, אנא נסה שוב"
  }
}
```

**New utility** `apps/web/src/lib/auth-errors.ts`:

```ts
export function translateAuthError(error: Error | string, t: (key: string) => string): string {
  const msg = typeof error === "string" ? error : error.message;
  // Match against known patterns
  if (/invalid.*(login|credentials)/i.test(msg)) return t("authErrors.invalidCredentials");
  if (/email.*not.*confirmed/i.test(msg)) return t("authErrors.emailNotConfirmed");
  if (/rate.*limit/i.test(msg)) return t("authErrors.rateLimitExceeded");
  if (/already.*(registered|exists)/i.test(msg)) return t("authErrors.userAlreadyExists");
  // ... etc
  return t("authErrors.default");
}
```

**Apply to:** login, register, forgot-password, reset-password pages — replace `setError(err.message)` with `setError(translateAuthError(err, t))`.

---

## Section 4: Resend Confirmation Email from Login Page

### Problem

Users who don't receive the signup confirmation email have no way to resend it. The auth callback failure (`?error=email_confirmation_failed`) is silently ignored by the login page.

### Solution

Add an inline "Resend confirmation" action on the login page + a minimal API endpoint.

### Changes

**New API endpoint** — `POST /api/auth/resend-confirmation`:

- Accept `{ email: string }`
- Call `supabase.auth.resend({ type: "signup", email })` using service role client
- Return 200 on success, error message on failure
- Rate limit: 1 request per 60 seconds per email (in-memory or reuse existing rate limiter)

This endpoint lives in a new router: `apps/api/src/routes/auth.ts`, mounted at `/api/auth` in `index.ts` (no auth required).

**`apps/web/src/app/[locale]/(auth)/login/page.tsx`** — Add below the password field:

- A small text link: "לא קיבלת אימייל אימות? שלח שוב" / "Didn't receive confirmation? Resend"
- Clicking reveals an inline email input + submit button (no navigation)
- On success: green success message "נשלח! בדוק את תיבת הדואר שלך"
- On error: translated Hebrew error

**Bonus: Handle `?error=email_confirmation_failed`** query param:

- On mount, check for this param and show a pre-expanded resend prompt

---

## Section 5: 2FA PIN via Email (All Users)

### Architecture

```
┌──────────┐     (1) email+password     ┌──────────────┐
│  Client  │ ─────────────────────────> │ POST /login   │
│  (login) │ <── (2) pending_token      │               │
│          │     + "check email"        └──────┬─────────┘
│          │                                   │
│          │                   generate PIN     │
│          │                   store + TTL      │
│          │                   send email       │
│          │                                   ▼
│          │                          ┌───────────────┐
│          │                          │   Supabase     │
└──────────┼──── (3) PIN enters ──────│   email        │
           │                          └───────────────┘
           │
    ┌──────▼──────┐     (4) verify PIN        ┌──────────────┐
    │  PIN entry  │ ────────────────────────> │ POST /verify  │
    │  page       │ <── (5) real session      │               │
    └─────────────┘                           └───────────────┘
```

### Flow

1. **Login form** — User submits email + password (existing form)
2. **Backend validates credentials** via `supabase.auth.signInWithPassword`
3. **On success** (instead of returning session):
   - Generate a 6-digit crypto-random PIN (`crypto.randomInt(100000, 999999)`)
   - Hash with SHA-256, store in `login_pins` table: `{ id, user_id, pin_hash, pending_token, expires_at, attempts, created_at }`
   - Send PIN email via Resend API (lightweight email provider, free tier sufficient). Supabase's built-in email only supports fixed auth event templates (confirmation, reset, magic link) — cannot send arbitrary PIN codes. Resend is the standard companion for this pattern in Supabase projects.
   - Return `{ pending_token, expires_in: 600 }` to client
4. **Client redirects** to `/login/verify?token=XXX`
5. **PIN entry page** — 6 input boxes (OTP-style), user enters code
6. **`POST /api/auth/verify-pin`**:
   - Look up by `pending_token`
   - Check expiry, check attempts (< 3)
   - Compare SHA-256 hash of submitted PIN
   - On success: create a real Supabase session (return to client via `setSession`)
   - On failure: increment attempts, return remaining attempts
7. **On session created** — redirect to dashboard (existing post-login logic)

### Database

New table `login_pins`:

```sql
CREATE TABLE login_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  pending_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

A cleanup function (called on each verification) deletes expired rows. Reminders scheduler can also purge old rows periodically.

### API Endpoints

**`POST /api/auth/login`** (modified from existing auth flow):

```ts
// After signInWithPassword succeeds:
const pin = crypto.randomInt(100000, 999999).toString();
const pinHash = createHash('sha256').update(pin).digest('hex');
const pendingToken = crypto.randomUUID();
// INSERT into login_pins
// Send email via Supabase admin API
return { pending_token: pendingToken, expires_in: 600 };
```

**`POST /api/auth/verify-pin`**:

```ts
// Look up by pending_token
// Validate: not expired, attempts < 3, pin hash matches
// On success: create supabase session, DELETE login_pins row
// On failure: increment attempts, return remaining
```

### Frontend

**New page: `apps/web/src/app/[locale]/(auth)/login/verify/page.tsx`**:

- 6 char OTP input (auto-advance between inputs)
- "Resend PIN" button with 60s cooldown
- Error display for wrong PIN / expired / max attempts
- On success: redirect to dashboard/admin

**`apps/web/src/app/[locale]/(auth)/login/page.tsx`** — modify:

- After form submission, check response for `pending_token` → redirect to verify page
- Keep error display for invalid credentials (before 2FA step)

### Middleware update

Allow unauthenticated access to `/login/verify` path — add to the matcher/allowlist in middleware.

### Edge Cases

- **PIN expires while entering:** "PIN expired, request a new one" — redirects back to login
- **Max attempts (3):** "Too many attempts, request a new PIN" — redirects back to login
- **User opens verify page directly without token:** redirect to login
- **Browser back button on verify page:** re-check session; if already logged in, redirect to dashboard
- **Admin onboarding:** New users created via admin skip 2FA for initial login (they get temp password). They'll go through 2FA on subsequent logins.
- **Concurrent PIN requests:** New PIN invalidates previous PIN for same user (DELETE old row before INSERT)

---

## Dependencies

| Package | Purpose | Section |
|---------|---------|---------|
| `resend` (npm) | Send PIN code emails via Resend API | 5 |
| `RESEND_API_KEY` env var | Resend API key in `.env` | 5 |

Note: Supabase auth emails (confirmation, reset, magic link) require SMTP configuration in the Supabase dashboard (e.g., via Resend's SMTP). Without this, Supabase emails silently fail. This is an existing issue unrelated to this spec — it should be configured as part of deployment setup.

---

## Testing

### Unit/Integration Tests

- **PKCE fix:** Test middleware code exchange with mock Supabase client
- **Admin onboarding:** Test existing user path (no password overwrite) vs new user path
- **Hebrew errors:** Snapshot test the error mapping function
- **Resend confirmation:** Test API endpoint rate limiting
- **2FA flow:** Integration test `POST /api/auth/login` → PIN generated, `POST /api/auth/verify-pin` → session returned
- **PIN expiry/attempts:** Test max attempts, expiry, concurrent request invalidation

### Manual Testing Checklist

- [ ] Reset password email link works from different browser
- [ ] Reset password email link works from mobile in-app browser
- [ ] Admin onboarding with existing email doesn't overwrite password
- [ ] Admin onboarding with new email creates temp password correctly
- [ ] Login page errors display in Hebrew
- [ ] Register page errors display in Hebrew
- [ ] Forgot-password page errors display in Hebrew
- [ ] Resend confirmation email arrives
- [ ] Resend confirmation rate limit (2 rapid clicks → 429 or cooldown)
- [ ] `?error=email_confirmation_failed` triggers resend prompt on login page
- [ ] Full 2FA flow: login → PIN → dashboard
- [ ] Wrong PIN shows remaining attempts
- [ ] Max attempts redirects back to login
- [ ] Expired PIN shows expired message
- [ ] Resend PIN button works (new PIN arrives, old one invalidated)
- [ ] Back button on verify page doesn't break flow
- [ ] Existing sessions bypass 2FA (already authenticated)

---

## File Manifest

| File | Action | Section |
|------|--------|---------|
| `apps/web/src/middleware.ts` | Modify — add code exchange | 1 |
| `apps/web/src/app/[locale]/(auth)/reset-password/page.tsx` | Simplify — remove client PKCE | 1 |
| `apps/api/src/modules/admin/admin.service.ts` | Modify — don't reset existing password | 2 |
| `packages/i18n/messages/he.json` | Modify — add authErrors | 3 |
| `apps/web/src/lib/auth-errors.ts` | **New** — error translation utility | 3 |
| `apps/web/src/app/[locale]/(auth)/login/page.tsx` | Modify — errors, resend, 2FA redirect | 3, 4, 5 |
| `apps/web/src/app/[locale]/(auth)/register/page.tsx` | Modify — Hebrew errors | 3 |
| `apps/web/src/app/[locale]/(auth)/forgot-password/page.tsx` | Modify — Hebrew errors | 3 |
| `apps/api/src/routes/auth.ts` | **New** — resend-confirmation + 2FA endpoints | 4, 5 |
| `apps/api/src/index.ts` | Modify — mount /api/auth router | 4, 5 |
| `apps/web/src/app/[locale]/(auth)/login/verify/page.tsx` | **New** — PIN entry page | 5 |
| `packages/db/supabase/migrations/XXXXXX_login_pins.sql` | **New** — login_pins table | 5 |
