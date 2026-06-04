import Redis from "ioredis";

let _client: Redis | null = null;

function getClient(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (!_client) {
    _client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    _client.on("error", (err: Error) =>
      console.error("[Redis] error:", err.message)
    );
  }
  return _client;
}

export async function cacheGet(key: string): Promise<string | null> {
  try { return await getClient()?.get(key) ?? null; } catch { return null; }
}

export async function cacheSet(key: string, value: string, ttl: number): Promise<void> {
  try { await getClient()?.set(key, value, "EX", ttl); } catch { /* ignore */ }
}

/** Delete all keys matching a glob pattern (e.g. "appts:abc123:*") */
export async function cacheClear(pattern: string): Promise<void> {
  const r = getClient();
  if (!r) return;
  try {
    const keys = await r.keys(pattern);
    if (keys.length) await r.del(...keys);
  } catch { /* ignore */ }
}
