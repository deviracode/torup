import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

async function loadMessages(locale: string): Promise<Record<string, unknown>> {
  if (process.env.NODE_ENV === "production") {
    // Bundled import — static, works anywhere the server runs.
    const mod = await import(`../../../../packages/i18n/messages/${locale}.json`);
    return mod.default as Record<string, unknown>;
  }
  // Dev: read from disk on every request. Webpack caches dynamically-imported
  // JSON modules, so edits to packages/i18n/messages/*.json would otherwise
  // stay invisible until a dev-server restart.
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const file = join(
    process.cwd(),
    "..",
    "..",
    "packages",
    "i18n",
    "messages",
    `${locale}.json`
  );
  return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as "he" | "ar" | "en")) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
