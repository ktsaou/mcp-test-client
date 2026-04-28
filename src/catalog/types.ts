import type { TransportKind } from '../mcp/types.ts';

/** Shape matches public/public-servers.schema.json */
export interface CatalogServer {
  id: string;
  name: string;
  url: string;
  transport: TransportKind | 'auto';
  description: string;
  tags?: string[];
  auth: 'none' | 'bearer' | 'oauth' | 'header';
  docs?: string;
  /** Plain-text guidance for getting the credential. See public/public-servers.schema.json. */
  instructions?: string;
  /** URL to the server's auth-setup docs. See public/public-servers.schema.json. */
  instructions_url?: string;
  addedAt: string;
  status: 'active' | 'unstable' | 'retired';
}

export interface Catalog {
  version: 1;
  servers: CatalogServer[];
}
