import type { Catalog, CatalogServer } from './types.ts';

/**
 * Loads the bundled catalog at `public-servers.json`. The catalog is shipped
 * as a static asset relative to the app's base URL, which means it works
 * under any deploy path (GitHub Pages subpath, Cloudflare Pages, localhost).
 *
 * Returns an empty catalog if the file is missing or malformed — this feature
 * is nice-to-have, never load-bearing.
 */
export async function loadCatalog(baseUrl: string = './'): Promise<Catalog> {
  const url = new URL('public-servers.json', new URL(baseUrl, window.location.href));
  try {
    const resp = await fetch(url.href, { cache: 'no-cache' });
    if (!resp.ok) return { version: 1, servers: [] };
    const raw: unknown = await resp.json();
    return sanitize(raw);
  } catch {
    return { version: 1, servers: [] };
  }
}

function sanitize(raw: unknown): Catalog {
  if (typeof raw !== 'object' || raw === null) return { version: 1, servers: [] };
  const obj = raw as Record<string, unknown>;
  const version = obj['version'] === 1 ? 1 : 1;
  const serversRaw = Array.isArray(obj['servers']) ? (obj['servers'] as unknown[]) : [];
  const servers: CatalogServer[] = [];
  for (const item of serversRaw) {
    if (typeof item !== 'object' || item === null) continue;
    const s = item as Record<string, unknown>;
    if (
      typeof s['id'] !== 'string' ||
      typeof s['name'] !== 'string' ||
      typeof s['url'] !== 'string' ||
      typeof s['transport'] !== 'string' ||
      typeof s['description'] !== 'string' ||
      typeof s['auth'] !== 'string' ||
      typeof s['addedAt'] !== 'string' ||
      typeof s['status'] !== 'string'
    ) {
      continue;
    }
    servers.push({
      id: s['id'],
      name: s['name'],
      url: s['url'],
      transport: s['transport'] as CatalogServer['transport'],
      description: s['description'],
      tags: Array.isArray(s['tags'])
        ? (s['tags'] as unknown[]).filter((t): t is string => typeof t === 'string')
        : undefined,
      auth: s['auth'] as CatalogServer['auth'],
      docs: typeof s['docs'] === 'string' ? s['docs'] : undefined,
      instructions: typeof s['instructions'] === 'string' ? s['instructions'] : undefined,
      instructions_url:
        typeof s['instructions_url'] === 'string' ? s['instructions_url'] : undefined,
      addedAt: s['addedAt'],
      status: s['status'] as CatalogServer['status'],
    });
  }
  return { version, servers };
}
