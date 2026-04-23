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
  addedAt: string;
  status: 'active' | 'unstable' | 'retired';
}

export interface Catalog {
  version: 1;
  servers: CatalogServer[];
}
