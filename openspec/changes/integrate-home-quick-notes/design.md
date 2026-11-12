# Design: Native Home and Quick Notes

## Context

See `proposal.md` for motivation, decision provenance and the implementation/production approval boundaries. Inspected base: `release/v0.1.0` at `afb3358e2520f5dd369824fc4980b9bd1b4ba743`.

Observed integration points:

- `apps/client/src/widgets/NoteDetail.tsx` resolves native/extended view types through `getExtendedWidgetType`; `note_types.tsx` lazily loads widgets. Normal root view can be overridden here without rewriting root's stored type/content.
- `RightPanelContainer.tsx` registers widgets and groups them by `RightPaneTabs.tsx`. It preserves opened tab bodies, but a hard close unmounts the right pane. Local component draft state is therefore insufficient.
- `MobileNotePanel.tsx` already uses `useRightPaneTabs` and `RightPaneTabBodies` inside a retained modal. The phone replacement for a simultaneous right column is this existing modal.
- `packages/trilium-core/src/services/hidden_subtree.ts` generates deterministic system IDs across peers. A nonempty definition `content` is enforced on checks, so defaults must not overwrite live JSON configuration on every startup.
- Quick Notes core/controller and adapter establish title/body capture, uncertain-save gating, direct-child scope, protected exclusion, native opening and owned `heliumQuickPinned`/`heliumQuickArchived` labels.
- Home queries define default limits 8/12/10, configurable `pinned`/`inbox` labels, optional archive filtering, protected exclusion and Inbox's labeled-folder children. Port semantics, not the arbitrary pre-filter Recent oversampling cutoff.

## Goals / Non-Goals

**Goals:** share one native feature implementation across desktop/phone; preserve native note identities and approved behaviors; converge hidden configuration and capture setup.

**Non-goals:** deploy in this change; expose Sol publicly; retire stock Trilium/Nootion; add offline queues, reminders, colors or external services; redesign the entire sidebar; build a general module installer; migrate data from the retired modules (VC, 2026-11-12); change the underlying app/sync version merely to name a fork release.

## Decisions

### 0. Compiled app code is mandatory; old packaging is not retained

VC explicitly accepts breaking the earlier modular design. Home and Quick Notes ship as compiled Preact/client code with core services/routes where needed. Neither is implemented or hosted by a note. Do not create feature Render Notes, executable JS/JSX/code notes, host notes, note-bundle builders or install/activate/uninstall commands, even inside `_hidden`. Hidden JSON config and ordinary captures are the only feature note storage; they never contain or execute the feature implementation.

First-run data initialization and UI presentation toggles are not module install/activation/uninstall APIs. Remove the two features' old packaging/build/lifecycle paths (`modules/home-panel`, `modules/quick-notes`) from the integrated product after porting their behavior/safety coverage; historical implementations remain available in Git history.

### 1. Root presentation is a view, not a data conversion

Add a lazy native Home view for `note.noteId === "root"` in normal view, respecting existing explicit source/attachments/map view precedence and protection handling. Root's underlying collection/list must not render below Home. Other notes, including ordinary books and Render Notes, keep their current rendering.

Do not mutate root type, content, labels, branches or startup-tab state just to display Home. Home is read-only; links go through native note contexts. Disabling the Home presentation returns root to its native view with the original data intact.

Port Recent/Pinned/Inbox as native Preact UI and native authenticated data access. Filter hidden/system/generated administrative/protected notes before limits, deduplicate by note ID, invalidate stale loads, and react to entity/protection changes. Existing configurable global Home pins/Inbox remain distinct from Quick Notes' own pin/archive state. No absent Inbox folder is created.

### 2. Add a stable Quick Notes tab to the existing registry

Extend `RightPaneTabId`/`RIGHT_PANE_TABS` with a localized Quick Notes tab and register its native Preact component in `RightPanelContainer.tsx`. It is available for every actual open note, including root, and does not depend on note type, AI enablement, a Render Note relation or module code. Preserve existing tab IDs, ordering behavior and other panels.

On phones, reuse `MobileNotePanel`'s shared registry/modal, tab bodies, navigation-dismiss callback and safe-area styling. A card navigates the current native context; on phone it dismisses the modal so the editor is visible.

### 3. Own drafts outside mounted panel bodies

Use app-window-lifetime, in-memory feature state for composer text, pending operation, uncertainty acknowledgement and selected Active/Archived/search state. Both desktop and phone presentations subscribe to it. Do not store a draft in hidden config, localStorage, IndexedDB or a sync option. A window reload can lose a draft, so keep an unload warning.

Keep explicit Save, blank rejection, first nonblank line title, escaped native HTML body and the no-blind-retry uncertain-save flow. Opening, closing or switching panels must not restart an operation. Do not clear newer text when an older save completes. Backend destination/membership/protection checks accompany UI checks; a stale client cannot write to a newly protected or unrelated destination.

### 4. Hidden feature state, ordinary capture data

Deterministic hidden structure:

| ID | Purpose |
|---|---|
| `_helium` | Hidden feature-state container under `_hidden` |
| `_heliumHomeConfig` | Versioned Home limits/selectors (JSON) |
| `_heliumQuickConfig` | Versioned Quick Notes `dataNoteId` (JSON) |

The hidden-subtree definitions carry no `content`, so edits are never overwritten. A setup step in the same hidden-subtree transaction writes default JSON only into an empty config note. Client uses internal routes and shared commons types, not imports from core. All core code runs in standalone's worker with no Node imports or `process.env`.

Typed presentation options `heliumHomeEnabled` and `heliumQuickNotesEnabled` (default true) via `OptionDefinitions`, options initialization and settings. Toggling changes presentation only.

Fresh setup creates exactly one normal, unprotected capture folder named `Quick Notes` under root with the deterministic non-underscore note ID `heliumQuickNotes` and branch ID `root_heliumQuickNotes`, so independently initialized peers converge on the same entities. It is created only when the Quick Notes config is first seeded. An unrelated top-level note already titled `Quick Notes` blocks creation (reported as a conflict); it is never claimed. Once configured, the destination's deletion/protection produces an actionable error, not automatic recreation.

### 5. No legacy migration (VC decision, 2026-11-12)

VC dropped the migration: Sol only holds test data. The built-in features ignore leftover module notes entirely: they do not read the old module config, do not adopt `Quick Notes — Notes`, and never modify or delete module notes. Home filters notes carrying the old module ownership labels (`heliumModuleId`, `heliumModuleConfig`, `heliumHomeHost`, `heliumQuickRetained`) out of its sections, so leftovers do not show up as clutter. Removing leftovers is the operator's manual job.

### Rollback

A presentation toggle disables either feature without deleting captured work. A full rollback is a matching build/database restore; there is no down-migration.

## Test Carryover and Evidence

Port the existing behavior/safety assertions before removing the module directories. Packaging-only lifecycle assertions become obsolete when no package is shipped.

| Existing test source | Native coverage to add / retain |
|---|---|
| `modules/quick-notes/test/core.spec.mjs` | Capture normalization/escaping/title, blank input, pending suppression, newer-draft retention, uncertain-save acknowledgement, scoped ordering/search |
| `modules/quick-notes/test/adapter.spec.mjs` | Folder-only create, owned pin/archive labels, unrelated/protected target refusal (core route spec) |
| `modules/quick-notes/test/lifecycle.spec.mjs`, `package.spec.mjs`, `transport.spec.mjs` | Dropped with the packaging and the migration |
| `modules/quick-notes/test/browser.mjs`, `integration.mjs` | Native panel spec plus a smoke run of the built server on a fresh database |
| `modules/home-panel/test/lifecycle.spec.mjs` | Home selectors/config defaults/protected exclusion ported to a core route spec; root-view and filter-before-limit assertions added; package/install checks retired |
| Existing `RightPanelContainer`, `MobileNotePanel` specs | Quick Notes tab present for any note, AI-independent |
| Core/server/standalone suites | Hidden initialization preserving edits, deterministic IDs |

Crew runs the narrowest native suites per changed area; core tests run through **both server and standalone** configurations, then `pnpm typecheck` once. Follow `CLAUDE.md`: no ESLint, no full suites.

Implementation adds English catalogue keys, matching component CSS, User Guide pages, a `.changelog` entry and fork release notes describing the packaging break. Physical-phone and VC acceptance remain separate from viewport emulation.

## Risks / Trade-offs

- [Hidden config generation overwrites edits] → no definition content, seed only when empty, restart regression coverage.
- [Protected notes leak via late responses] → filter on the server before summaries, drop stale responses by generation.
- [Fresh independent peers create competing folders] → deterministic note and branch IDs.
- [App-lifetime drafts vanish on full reload] → unload warning, explicit Save and no persistent-draft promise.
- [Leftover module notes stay in the tree] → accepted by VC; the operator removes them by hand.

## Open Questions for VC / Release Gates

1. **Phone surface:** Quick Notes in the existing note-panel modal rather than a persistent side column. VC approved (2026-11-12 crew brief).
2. **Physical phone acceptance** remains separate from emulation.
