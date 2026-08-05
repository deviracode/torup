import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const i18nMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Don't touch auth callbacks — the route handler manages its own cookies
  if (path.includes("/auth/")) {
    // Rewrite locale-prefixed auth paths to root (e.g. /he/auth/callback → /auth/callback)
    const match = path.match(/^\/(he|ar|en)\/auth\/(.*)/);
    if (match) {
      const url = request.nextUrl.clone();
      url.pathname = `/auth/${match[2]}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

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
