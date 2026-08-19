# Auth Improvements — Design Spec

**Date:** 2026-08-05
**Status:** approved

## Overview

Four improvements to the authentication system:

1. **PKCE fix** — Password reset links fail with "PKCE code verifier not found"
2. **Don't overwrite existing passwords** — Admin onboarding resets existing user passwords
3. **Hebrew error messages** — Auth pages display raw English errors
4. **Resend confirmation email** — No way to resend signup confirmation from login page

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

## Testing

### Unit/Integration Tests

- **PKCE fix:** Test middleware code exchange with mock Supabase client
- **Admin onboarding:** Test existing user path (no password overwrite) vs new user path
- **Hebrew errors:** Snapshot test the error mapping function
- **Resend confirmation:** Test API endpoint rate limiting

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

---

## File Manifest

| File | Action | Section |
|------|--------|---------|
| `apps/web/src/middleware.ts` | Modify — add code exchange | 1 |
| `apps/web/src/app/[locale]/(auth)/reset-password/page.tsx` | Simplify — remove client PKCE | 1 |
| `apps/api/src/modules/admin/admin.service.ts` | Modify — don't reset existing password | 2 |
| `packages/i18n/messages/he.json` | Modify — add authErrors | 3 |
| `apps/web/src/lib/auth-errors.ts` | **New** — error translation utility | 3 |
| `apps/web/src/app/[locale]/(auth)/login/page.tsx` | Modify — Hebrew errors, resend confirmation | 3, 4 |
| `apps/web/src/app/[locale]/(auth)/register/page.tsx` | Modify — Hebrew errors | 3 |
| `apps/web/src/app/[locale]/(auth)/forgot-password/page.tsx` | Modify — Hebrew errors | 3 |
| `apps/api/src/routes/auth.ts` | **New** — resend-confirmation endpoint | 4 |
| `apps/api/src/index.ts` | Modify — mount /api/auth router | 4 |
