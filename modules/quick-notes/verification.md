# Quick Notes v1 verification and release gates

Date: 2026-11-12. Status: development implementation, not a production release.

## Observed target

- Official TriliumNext/Trilium server v0.107.0, commit `d83d7151f1c6d4292be88d8d34008f409b252f7f` (release archive build reports `d83d7151f1`).
- Linux x64 archive: `TriliumNotes-Server-v0.107.0-linux-x64.tar.xz`.
- Archive SHA256: `a217b5ac702e4bd9d401cfd5c6e9ee25f0a6f4a0c67345c65bd67dc8663d3dce`.
- Real `/etapi/app-info`: application 0.107.0, database 242, sync 41. Packaged server Node v24.22.2; test runner Node v26.13.1; Chromium 156.0.8078.79; Playwright 1.65.0.
- Fresh synthetic DB, loopback only, authentication enabled, backend scripting disabled. Existing production notes were never used.

## Executed evidence

- Test-first red/green slices covered capture, empty/markup text, pending/uncertain saves and explicit retry acknowledgment, scoped search/order, protected/unrelated targets, native-editor activation, version checks, deterministic inert ZIP metadata, guarded lifecycle, shared/reference/descendant conflicts, approval drift and interrupted-removal drift.
- Standalone Chromium fixture exercises desktop/375px controls, capture, pin, archive/restore, title/body filtering, native-open callback, in-memory draft retention, pending freeze, keyboard focus and inert HTML previews. This is UI evidence, not a real Trilium adapter test by itself.
- Real packaged server harness imports the actual ZIP, confirms no active relation on install, activates idempotently, creates a persisted native note, tests pin/archive/search, activates the actual native editor, previews a native rich-text body without modifying it, captures from a mobile-UA context at 375px, disables/reloads, then performs the VC-authorized removal of six generated code notes and reinstalls with folder/config/notes preserved.
- Full successful runtime test output and final unit/build/ZIP checks are recorded in `/home/vc/plans/notes-app/verification/quick-notes-final-*.txt`.

## Integration issues caught rather than hidden

- The target rejects new children under virtual `_hidden`. The installer now imports its code root under ordinary `root`; retained user state is a separate sibling area.
- Trilium bundle `require()` resolves direct child modules, not siblings. Dependencies are passed explicitly into the view, with a package regression test of direct-child imports.
- Native `openTabWithNote` left a background tab in this Render Note context. Cards now use `api.activateNote`; the real integration test asserts the active native context ID.
- ETAPI content replacement requires raw `text/plain` wire bodies (`express.text()`), not JSON strings or `text/html`. The transport regression test covers the body/header contract.
- Cached hidden native note contexts can duplicate text/selectors. UI assertions are scoped to the visible Quick Notes region; hidden contexts are not counted as extra visible boards.

## Review status and limits

- Jev favored a draft implementation PR with maintenance-only removal and explicitly identified atomic-removal/independent-data-review as a production gate.
- The separate frontend Jev check returned `jev_unsure`; its nominal no-blocker answer is NOT treated as independent approval. A formal independent integration/security/data reviewer is still required. No coding-agent/reviewer CLI was available in this sandbox; no reviewer approval is fabricated.
- ETAPI deletion is not atomically conditional on the graph snapshot. Leaf rechecks, a plan hash and `--maintenance-confirmed` reduce accidental removal but do not eliminate a last-check/delete race. No unattended production uninstall/upgrade is approved.
- Only an upstream release runtime was exercised, not an exact Helium-III application build or the deployed Sol instance. Matching version numbers alone do not establish compatibility.
- Mobile-UA Chromium emulation is not a physical-phone trial or Safari/iOS acceptance. Real-phone workflow acceptance remains open.
- Protected-note exclusion/destination rejection have adapter tests; full protected-session transitions on the exact target remain a security acceptance check.
- Native backup/restore, production deployment, source-data migration, and VC usability acceptance were not performed by these module tests. Production installation/deletion remain separate approvals.

## Source contracts inspected

`apps/client/src/services/frontend_script_api.ts` (`createNote`, `activateNote`, `reloadNotes`); `note_create.ts` (activate/protection behavior); `server.ts` (CSRF/base API); `attributes.ts` (`set-attribute`); `apps/client/src/entities/fnote.ts` (owned attributes/children/content); `packages/trilium-core/src/services/script.ts` (`getScriptBundle`); `apps/server/src/etapi/{notes,mappers,auth}.ts`; `apps/server/src/app.ts` (body parsers). Internal authenticated route usage is target-coupled and must be retested on upstream/fork changes.
