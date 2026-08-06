# Auth Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix PKCE password reset, stop admin onboarding from overwriting existing passwords, translate auth errors to Hebrew, and add resend confirmation email from login page.

**Architecture:** Minimal changes across 8 files. Server-side PKCE exchange in middleware, single-line fix in admin service, shared error translation utility with i18n keys, and a single new API route for resend confirmation.

**Tech Stack:** Next.js 15, Express 5, Supabase SSR, next-intl, pnpm workspace

---

### Task 1: PKCE Fix — Server-Side Code Exchange in Middleware

**Files:**
- Modify: `apps/web/src/middleware.ts`
- Modify: `apps/web/src/app/[locale]/(auth)/reset-password/page.tsx`

- [ ] **Step 1: Add code exchange logic to middleware**

In `apps/web/src/middleware.ts`, add a block after the auth callback passthrough (after line 21, before `let response = NextResponse.next(...)`) that handles reset-password code exchange:

```typescript
  // Handle reset-password PKCE code exchange server-side
  if (path.includes("/reset-password")) {
    const code = request.nextUrl.searchParams.get("code");
    if (code) {
      const url = request.nextUrl.clone();
      url.searchParams.delete("code");
      const redirect = NextResponse.redirect(url);

      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll: () => request.cookies.getAll(),
            setAll: (cookiesToSet) => {
              cookiesToSet.forEach(({ name, value, options }) => {
                redirect.cookies.set(name, value, options);
              });
            },
          },
        }
      );

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        const locale = path.split("/")[1];
        const validLocale = routing.locales.includes(locale as "he" | "ar" | "en") ? locale : "he";
        return NextResponse.redirect(new URL(`/${validLocale}/login?error=reset_link_expired`, request.url));
      }

      return redirect;
    }
  }
```

- [ ] **Step 2: Simplify reset-password page — remove client-side PKCE**

Replace the `useEffect` in `apps/web/src/app/[locale]/(auth)/reset-password/page.tsx` (lines 23-41) with a simpler version that reads the session from cookies:

```typescript
  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setReady(true);
      } else {
        setError(isRtl ? "קישור לא תקין או פג תוקף" : "Invalid or expired link");
        setReady(true);
      }
    };
    check();
  }, [supabase, isRtl]);
```

Remove the old code that handled `exchangeCodeForSession` and `setSession` (the old `establish` function). Also remove the unused `Session` import if it was only used in the old code.

- [ ] **Step 3: Verify**

Run: `pnpm dev` in the root, then test forgot-password flow:
1. Go to `http://localhost:3000/he/forgot-password`
2. Enter an email of an existing user
3. Check Supabase dashboard → Authentication → Users → click the user → "Send password recovery" to get a real link
4. Open the link — should redirect to reset-password page with working session

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/middleware.ts apps/web/src/app/\[locale\]/\(auth\)/reset-password/page.tsx
git commit -m "fix: handle PKCE code exchange server-side in middleware for password reset"
```

---

### Task 2: Admin Onboarding — Don't Reset Existing Passwords

**Files:**
- Modify: `apps/api/src/modules/admin/admin.service.ts`

- [ ] **Step 1: Remove password overwrite for existing users**

In `apps/api/src/modules/admin/admin.service.ts`, replace the `if (existing)` block (lines 41-43):

```typescript
        if (existing) {
          ownerId = existing.id;
          // Don't reset existing user's password
        } else {
```

Also remove the `tempPw = generateTempPassword()` on line 40 since it's no longer needed when the user already exists. Move it inside the `else` block:

The full updated section (lines 36-55):

```typescript
      let tempPw: string | null = null;
      if (owner_email) {
        let ownerId: string | null = null;
        const { data: list } = await supabase.auth.admin.listUsers();
        const existing = list?.users?.find((u: any) => u.email === owner_email);
        if (existing) {
          ownerId = existing.id;
        } else {
          tempPw = generateTempPassword();
          const { data: cr, error: cErr } = await supabase.auth.admin.createUser({
            email: owner_email,
            password: tempPw,
            email_confirm: true,
            user_metadata: { role: "business_owner" },
          });
          if (cErr) throw new AppError(400, cErr.message);
          if (cr?.user) ownerId = cr.user.id;
        }
        if (ownerId)
          await repo.createMember({ business_id: biz.id, user_id: ownerId, role: "owner" });
      }
```

And update the return on line 65 to include `user_already_exists`:

```typescript
      return { ...biz, temp_password: tempPw, user_already_exists: !!existing };
```

- [ ] **Step 2: Verify**

Run: `pnpm dev` in root, then create a business via admin API with an existing email:

```bash
curl -X POST http://localhost:3001/api/admin/businesses \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Biz", "owner_email": "existing@email.com"}'
```

Expected: Response has `"user_already_exists": true` and no `temp_password`. The existing user's password should be unchanged (verify by logging in with their old password).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/admin/admin.service.ts
git commit -m "fix: don't overwrite existing user password during admin onboarding"
```

---

### Task 3: Hebrew Error Messages on Auth Pages

**Files:**
- Modify: `packages/i18n/messages/he.json`
- Create: `apps/web/src/lib/auth-errors.ts`
- Modify: `apps/web/src/app/[locale]/(auth)/login/page.tsx`
- Modify: `apps/web/src/app/[locale]/(auth)/register/page.tsx`
- Modify: `apps/web/src/app/[locale]/(auth)/forgot-password/page.tsx`
- Modify: `apps/web/src/app/[locale]/(auth)/reset-password/page.tsx`

- [ ] **Step 1: Add auth error translations to he.json**

In `packages/i18n/messages/he.json`, add an `authErrors` namespace after the `appointments` block (after line 255, before the closing `}`):

```json
  "authErrors": {
    "invalidCredentials": "פרטי התחברות שגויים",
    "emailNotConfirmed": "האימייל לא אומת. בדוק את תיבת הדואר שלך ושלח שוב במידת הצורך",
    "rateLimitExceeded": "נסה שוב בעוד מספר דקות",
    "userAlreadyExists": "משתמש עם אימייל זה כבר רשום",
    "userNotFound": "לא נמצא משתמש עם אימייל זה",
    "invalidEmail": "כתובת אימייל לא תקינה",
    "weakPassword": "הסיסמה חייבת להכיל לפחות 6 תווים",
    "expiredLink": "הקישור פג תוקף, בקש קישור חדש",
    "default": "אירעה שגיאה, אנא נסה שוב"
  }
```

Note: Make sure to add a comma after line 255 (`}`) before adding this block:

```json
    "noShow": "לא הגיע"
  },
  "authErrors": {
```

- [ ] **Step 2: Create auth error translation utility**

Create `apps/web/src/lib/auth-errors.ts`:

```typescript
export function translateAuthError(
  error: Error | string,
  t: (key: string) => string
): string {
  const msg = typeof error === "string" ? error : error.message;

  if (/invalid\s*(login|credentials)/i.test(msg)) return t("authErrors.invalidCredentials");
  if (/email\s*not\s*confirmed/i.test(msg)) return t("authErrors.emailNotConfirmed");
  if (/rate\s*limit/i.test(msg)) return t("authErrors.rateLimitExceeded");
  if (/already\s*(registered|exists)/i.test(msg)) return t("authErrors.userAlreadyExists");
  if (/user\s*not\s*found/i.test(msg)) return t("authErrors.userNotFound");
  if (/invalid\s*email/i.test(msg)) return t("authErrors.invalidEmail");
  if (/(weak|short)\s*password/i.test(msg)) return t("authErrors.weakPassword");
  if (/expired/i.test(msg)) return t("authErrors.expiredLink");

  return t("authErrors.default");
}
```

- [ ] **Step 3: Apply to login page**

In `apps/web/src/app/[locale]/(auth)/login/page.tsx`:

Add import at top (after existing imports):

```typescript
import { translateAuthError } from "@/lib/auth-errors";
```

Replace line 34:
```typescript
      setError(err instanceof Error ? err.message : "Login failed");
```

With:
```typescript
      setError(translateAuthError(err as Error, t));
```

- [ ] **Step 4: Apply to register page**

In `apps/web/src/app/[locale]/(auth)/register/page.tsx`:

Add import:
```typescript
import { translateAuthError } from "@/lib/auth-errors";
```

Replace line 34:
```typescript
      setError(err instanceof Error ? err.message : "Registration failed");
```

With:
```typescript
      setError(translateAuthError(err as Error, t));
```

- [ ] **Step 5: Apply to forgot-password page**

In `apps/web/src/app/[locale]/(auth)/forgot-password/page.tsx`:

Add import:
```typescript
import { translateAuthError } from "@/lib/auth-errors";
```

Replace line 33:
```typescript
      setError(err instanceof Error ? err.message : "Failed to send reset link");
```

With:
```typescript
      setError(translateAuthError(err as Error, t));
```

- [ ] **Step 6: Apply to reset-password page**

In `apps/web/src/app/[locale]/(auth)/reset-password/page.tsx`:

Add import:
```typescript
import { translateAuthError } from "@/lib/auth-errors";
```

Replace line 52:
```typescript
      setError(err instanceof Error ? err.message : "Failed to update password");
```

With:
```typescript
      setError(translateAuthError(err as Error, t));
```

- [ ] **Step 7: Verify**

Run `pnpm dev` and test:
1. Login with wrong password → should show Hebrew error "פרטי התחברות שגויים"
2. Register with existing email → Hebrew error
3. Forgot password with unknown email → Hebrew error
4. Non-Hebrew locales should show the `t()` call which falls back to the `authErrors` keys if not translated for that locale

- [ ] **Step 8: Commit**

```bash
git add packages/i18n/messages/he.json apps/web/src/lib/auth-errors.ts apps/web/src/app/\[locale\]/\(auth\)/login/page.tsx apps/web/src/app/\[locale\]/\(auth\)/register/page.tsx apps/web/src/app/\[locale\]/\(auth\)/forgot-password/page.tsx apps/web/src/app/\[locale\]/\(auth\)/reset-password/page.tsx
git commit -m "feat: translate auth error messages to Hebrew on login, register, forgot-password, reset-password pages"
```

---

### Task 4: Resend Confirmation Email from Login Page

**Files:**
- Create: `apps/api/src/routes/auth.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/web/src/app/[locale]/(auth)/login/page.tsx`

- [ ] **Step 1: Create auth router with resend confirmation endpoint**

Create `apps/api/src/routes/auth.ts`:

```typescript
import { Router, type Router as RouterType, type Request, type Response, type NextFunction } from "express";
import { createServiceClient } from "../lib/supabase";
import { AppError } from "../middleware/error-handler";

const router: RouterType = Router();

const resendCooldowns = new Map<string, number>();

router.post("/resend-confirmation", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      throw new AppError(400, "Email is required");
    }

    const now = Date.now();
    const lastSent = resendCooldowns.get(email.toLowerCase());
    if (lastSent && now - lastSent < 60_000) {
      throw new AppError(429, "Please wait before requesting another email");
    }

    const supabase = createServiceClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.toLowerCase().trim(),
      options: { emailRedirectTo: `${process.env.APP_URL || "http://localhost:3000"}/auth/callback` },
    });

    if (error) throw new AppError(400, error.message);

    resendCooldowns.set(email.toLowerCase(), now);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 2: Mount auth router in the Express app**

In `apps/api/src/index.ts`, add the import (after line 25, before the scheduler imports):

```typescript
import authRouter from "./routes/auth";
```

And mount it after the health check (after line 77), before the business routes:

```typescript
// Auth routes (unauthenticated)
app.use("/api/auth", authRouter);
```

- [ ] **Step 3: Add resend confirmation UI to login page**

In `apps/web/src/app/[locale]/(auth)/login/page.tsx`, add after the password field's closing `</div>` (after line 92), before the submit button (line 94):

```typescript
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowResend(!showResend)}
            className="text-xs text-white/40 hover:text-[#a78bfa] transition-colors"
          >
            {isRtl ? "לא קיבלת אימייל אימות? שלח שוב" : "Didn't receive confirmation? Resend it"}
          </button>
        </div>

        {showResend && (
          <div className="space-y-2 rounded-lg bg-white/5 border border-white/10 p-3">
            <p className="text-xs text-white/60">
              {isRtl ? "הזן את האימייל שלך לשליחת אימייל האימות מחדש" : "Enter your email to resend the confirmation"}
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                required
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="name@example.com"
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                disabled={resendLoading}
                onClick={handleResend}
                className="rounded-[10px] bg-[#6366f1]/20 border border-[#6366f1]/30 px-3 py-2 text-xs font-medium text-[#a78bfa] hover:bg-[#6366f1]/30 transition-colors disabled:opacity-50"
              >
                {resendLoading ? t("loading") : (isRtl ? "שלח" : "Send")}
              </button>
            </div>
            {resendSuccess && (
              <p className="text-xs text-green-400">
                {isRtl ? "נשלח! בדוק את תיבת הדואר שלך" : "Sent! Check your email"}
              </p>
            )}
            {resendError && (
              <p className="text-xs text-red-300">{resendError}</p>
            )}
          </div>
        )}
```

Add the new state variables after line 22 (`const [loading, setLoading] = useState(false)`):

```typescript
  const [showResend, setShowResend] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState("");
```

Add the `handleResend` function after `handleSubmit` (after line 39):

```typescript
  const handleResend = async () => {
    if (!resendEmail) return;
    setResendError("");
    setResendSuccess(false);
    setResendLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/auth/resend-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to resend");
      }
      setResendSuccess(true);
    } catch (err) {
      setResendError(translateAuthError(err as Error, t));
    } finally {
      setResendLoading(false);
    }
  };
```

Add the API_URL import at the top is not needed since we use `process.env.NEXT_PUBLIC_API_URL` which is available client-side in Next.js.

Also add `useSearchParams` import to handle `?error=email_confirmation_failed` query param on mount. Replace the import line:

```typescript
import { useRouter, useSearchParams } from "next/navigation";
```

And add a `useEffect` to show the resend prompt automatically:

```typescript
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("error") === "email_confirmation_failed") {
      setShowResend(true);
    }
  }, [searchParams]);
```

- [ ] **Step 4: Verify**

Run: `pnpm dev` and test:
1. Go to login page → see the "Didn't receive confirmation?" link
2. Click it → inline form appears
3. Enter an email that just registered → confirmation email arrives
4. Enter same email again within 60 seconds → rate limit error
5. Go to `http://localhost:3000/he/login?error=email_confirmation_failed` → resend form shows automatically

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/auth.ts apps/api/src/index.ts apps/web/src/app/\[locale\]/\(auth\)/login/page.tsx
git commit -m "feat: add resend confirmation email endpoint and inline UI on login page"
```

---

### Final Verification

- [ ] Run full dev environment: `pnpm dev`
- [ ] Test password reset from different browser/incognito
- [ ] Test admin onboarding with existing email (password unchanged)
- [ ] Test admin onboarding with new email (temp password returned)
- [ ] Test all 4 auth pages show Hebrew errors
- [ ] Test resend confirmation flow + rate limit
- [ ] Test `?error=email_confirmation_failed` auto-shows resend
