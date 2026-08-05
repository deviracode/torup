import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const i18nMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Pass through /auth/* routes directly (no locale prefix, no i18n)
  if (path.startsWith("/auth/")) {
    return response;
  }

  // Rewrite locale-prefixed auth callback (Supabase may redirect with locale in URL)
  const authCallbackMatch = path.match(/^\/(he|ar|en)\/auth\/(.*)/);
  if (authCallbackMatch) {
    const url = request.nextUrl.clone();
    url.pathname = `/auth/${authCallbackMatch[2]}`;
    return NextResponse.rewrite(url);
  }

  const isProtected = path.includes("/dashboard") || path.includes("/admin");
  const locale = path.split("/")[1];
  const isValidLocale = routing.locales.includes(locale as "he" | "ar" | "en");

  if (isProtected) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const redirectLocale = isValidLocale ? locale : "he";
      return NextResponse.redirect(new URL(`/${redirectLocale}/login`, request.url));
    }
  }

  return i18nMiddleware(request);
}

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
