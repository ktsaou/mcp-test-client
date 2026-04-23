# catalog/

Loader for the bundled public-servers catalog (`public/public-servers.json`).

The catalog is intentionally tiny: a JSON file shipped as a static asset,
fetched at runtime, and merged with the user's saved servers in the UI.
Governance + schema live in
[`specs/public-servers-catalog.md`](../../specs/public-servers-catalog.md).

The loader is resilient by design — any parse/network failure returns an
empty catalog. Community users live behind CORS, DNS, and flaky hosting;
the app must keep working when the catalog is unreachable.
