# DEC-006 — JSON view ships independently of the framework migration (2026-04-25)

**Problem.** The newline-respecting JSON view ([DEC-003](DEC-003-json-view-newlines.md)) blocks the most-cited
readability complaint and is independent of UI framework choice. Holding it
behind the framework migration delays the user-visible win.

**Options considered.**

- _Bundle into the Mantine migration PR._ Single big PR; longer to land.
- _Land as its own PR now, ahead of Mantine._ Gets the readability win to
  users this session; the framework migration then changes only chrome.

**Decision.** Land [DEC-003](DEC-003-json-view-newlines.md)'s JSON view rewrite (with copy/save buttons)
ahead of the Mantine migration. CSS uses our existing tokens; no Mantine
dependencies; risk of regression on the Mantine PR is nil because the JSON
view sits inside whichever shell.

**Falsifier.** The CSS tokens conflict with Mantine theming when Mantine
lands. If they do, port the styling to use Mantine's CSS variables there.

**Advisor sign-off.** UX critic to confirm the rendered output passes the
"multi-line markdown in `content[0].text`" test before tagging v1.0.x.

**Status.** In flight — code merged in this session's commit; live URL
update follows the next deploy.
