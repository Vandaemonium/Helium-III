# Integrate Home and Quick Notes into Helium-III

## Why

The installed Home and Quick Notes modules expose implementation/configuration notes in the tree and make app features look like specialized notes. VC wants Home on the real root and Quick Notes beside any open note, while keeping captures as ordinary notes and removing the module clutter safely.

## What Changes

- **BREAKING:** implement Home and Quick Notes as Preact/client and core app code compiled into the fork, not specialized notes. For these two features there are no Render Notes, executable code notes, host notes, imported bundles or install/activate/uninstall lifecycle. Drop their module packaging rather than preserve the old modular-design constraint. Other modules and user-owned native Render Notes are unaffected.
- Opening `root` in its normal view shows Home: Recent, Pinned and Inbox. Preserve root content, identity, children and explicit alternate views; do not turn root into a generated Render Note.
- Add Quick Notes to the existing right-sidebar tab registry. On phones use the same feature in `MobileNotePanel`, not a second tree-host note or a permanently squeezed side column.
- Preserve approved Quick Notes v1: explicit Save, first nonblank line as title, escaped text capture, cards, scoped pin/archive/search, native editing, uncertain-save handling and exclusion of all protected notes, even unlocked ones.
- Store config and migration state under deterministic `_helium...` notes inside `_hidden`; expose only one feature-owned visible `Quick Notes` capture folder. Hidden is not encrypted.
- Provide fresh-instance setup and an idempotent, previewed, operator-approved migration from either/both installed modules. Adopt the existing capture folder and retain every captured note ID, body, branch, protection setting and pin/archive label. Copy configuration before retiring exact generated code/config/host assets; never cascade into user notes.
- Carry existing module behavior/safety tests into native client/core coverage, then require migration, desktop, phone and restore acceptance before release.

## Capabilities

### New Capabilities

- `home-dashboard`: root-only built-in overview and safe navigation/filtering.
- `quick-notes-panel`: shared desktop/mobile capture panel and preserved Quick Notes behavior.
- `helium-feature-storage`: hidden configuration, one visible destination, native data and repeatable initialization.
- `legacy-module-migration`: verified adoption, exact cleanup, refusal/recovery and operator approval.

### Modified Capabilities

None under `openspec/specs/`: `openspec list --specs` currently reports no canonical specs. The earlier `home-widget-module-v1` and `quick-notes-module-v1` changes remain historical evidence, not additional simultaneous requirements to install modules. This change supersedes their packaging/entry-point requirements for these two features only; their data-preservation and user-behavior guarantees carry forward. Reconcile archival when the implementation is accepted, not by marking unfinished legacy tasks complete now.

## Impact

- Base: `release/v0.1.0`, inspected commit `afb3358e2520f5dd369824fc4980b9bd1b4ba743` (draft PR #5). Implementation must re-fetch and reconcile later changes.
- Client: `NoteDetail.tsx`/`note_types.tsx`, native Preact components, `RightPanelContainer.tsx`, `RightPaneTabs.tsx`, `MobileNotePanel.tsx`, shared draft state, English translations and typed options.
- Core: `hidden_subtree.ts`, authenticated internal routes/services using Becca and sync-aware entities; shared with server, desktop and standalone. Do not bypass the cache, import core into the client, embed ETAPI credentials or enable backend scripting.
- Legacy sources: `modules/home-panel/` and `modules/quick-notes/`; port behavior/safety assertions and retain only inert test-only migration fixtures as needed, then retire these features' packaging/build/install/activate/uninstall paths from the integrated product. No supported feature installer, runtime note-bundle dependency or legacy activation fallback remains.
- User Guide, `.changelog`, fork release notes and migration/rollback runbook are implementation deliverables.
- No production access, deletion, deployment, release tag, Nootion migration or stock-Trilium change is performed by this specification. Claude's Opus crew implements; VC reviews a draft implementation PR; Houston handles any separately approved Sol maintenance.

## Decision Provenance and Approval Boundary

VC's follow-up clarification, relayed by Claude and appended to the brief: "Just to be clear, these features need to be BUILT IN to the UI, not just special notes. And honestly, if that breaks the modular design plan, I'm fine with that." This is a firm implementation constraint, not an open modularity question. Hidden inert config and ordinary captured notes are storage, never feature entry points. A one-time legacy-data migration is not a retained module installation lifecycle.

Source: Claude's brief `~/plans/notes-app/brief-integrate-home-quick-notes.md`, dated 2026-11-12, attributing the integration choices to VC. The requested canonical section `2026-11-12 evening (VC with Claude Code: Helium-III integration)` was not present in the readable local mirror; that mirror subsequently became unavailable during inspection. Reconcile that exact section before implementation sign-off; do not present this mirror gap as a contrary VC decision or invent a production inventory. The brief's installed Sol modules/seven top-level notes are reported context, not independently inspected production evidence.

Jev reviewed the proposed mobile surface, app-lifetime in-memory drafts and transactional/approved migration and selected all three recommended approaches. A later publication-readiness check returned a selection **with `jev_unsure: ["review"]`**, so it is not independent approval; leave final readiness to Claude/VC review. These are proposed implementation defaults, not replacements for VC approval. Remaining approval questions and recommended answers are in `design.md`.
