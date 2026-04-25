# DEC-010 — v1.1 ship blockers (2026-04-25)

**Problem.** UX-critic pass on commit `ec7f6ee` (the v1.1 candidate) returned
**no-ship** with three concrete blockers and four borderline items. v1.1
cannot deploy until the three blockers are closed and a re-critic clears.

**The three blockers, with the directional fix for each:**

1. **Mobile viewport (390×844) is unusable.**
   - Current behaviour: four panes share width; REQUEST clips, header
     overlaps, "No servers yet" wraps to 1-letter columns.
   - Direction: introduce a responsive collapse below ~768 px. Sidebar
     becomes a Mantine `Drawer` triggered from a hamburger in the header;
     inspector / request / log become Mantine `Tabs` stacked in the main
     area. Above 768 px, behaviour is unchanged.
   - File scope: `src/ui/layout.tsx` and a small `useMediaQuery` from
     `@mantine/hooks`. Possibly `src/ui/connection-bar.tsx` for the
     hamburger trigger.
   - Reject: media-query CSS-only collapse — the panel-resizer state would
     persist into hidden panes and re-expand wrong on rotation.

2. **Share link drops the tool call.**
   - Current behaviour: hash fragment encodes server + tool + args
     correctly (`src/share-url/encode.ts`), but
     `src/ui/share-url-loader.tsx` only materialises the server. Tool
     selection and form pre-fill are lost.
   - Direction: lift the `Selection` state currently held in
     `src/ui/layout.tsx` into a context (or pass a one-shot
     "initial-selection" hint into Layout). On share-link load, after the
     server is registered and the connection is initiated, the loader
     selects the tool and seeds the form value with `state.args` (or the
     raw editor with `state.raw`).
   - Falsifier scope per the values.md promise: server + tool + method
     - argument values all reconstruct.
   - File scope: `src/ui/share-url-loader.tsx`, `src/ui/layout.tsx`,
     possibly `src/state/` for a small initial-selection context.

3. **Enter does not submit the Add Server / Save-as modals.**
   - Current behaviour: Mantine `Modal` traps focus and Esc closes (good),
     but Enter on the URL field does nothing.
   - Direction: wrap the modal body in `<form onSubmit={handleSave}>` and
     mark the primary action button `type="submit"`. Same pattern in
     `canned-requests.tsx`'s SaveAsModal.
   - File scope: `src/ui/server-picker.tsx`, `src/ui/canned-requests.tsx`.

**Out of scope for this v1.1 fix (defer to v1.1.1).**

- Empty-state copy (still one-liners; DEC-007).
- Light-theme log timestamp contrast (~2.85:1, fails WCAG AA).
- ARIA `valuemin > valuemax` on a panel separator.
- Log virtualization at 200+ messages (already deferred by DEC-007).
- Per-response metrics (DEC-009 — its own v1.1.1 release).

**Falsifier.** A re-spawned UX-critic against the patched dev build
returns no-ship for any of the three blockers. Then the patch was wrong.

**Advisor sign-off.** UX critic surfaced the blockers; the patch is gated
on a fresh UX-critic pass post-fix.

**Status.** Open. Worker brief drafted next; v1.1 push gated on Worker
delivering green pipeline + critic sign-off.
