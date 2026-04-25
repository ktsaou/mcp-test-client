# Differentiators (what we beat MCP Inspector at)

- **Zero install, hosted-friendly.** They can't be hosted publicly because
  of the stdio proxy. We are exactly that.
- **Better schema rendering.** They are stuck on Ajv 6 / draft-07 with
  known gaps in `$ref` / `oneOf` / `additionalProperties`. We use Ajv 8 /
  2020-12 and render those constructs properly.
- **Shareable URLs.** A link encodes the request so a teammate can
  reproduce the call. They have an open issue for this; we ship it.
- **WebSocket support.** We have it as a custom transport (with caveats);
  they don't.
- **No CVE-class spawn-and-proxy attack surface** (because no proxy).
