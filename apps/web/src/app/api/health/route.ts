// Dedicated healthcheck endpoint for Railway. Deliberately outside the
// [locale] segment so the locale middleware's matcher (which already
// excludes /api/*) never redirects it — "/" always 307s to "/he", which
// some healthcheck probers may not treat as a healthy response.
export function GET() {
  return new Response("ok", { status: 200 });
}
