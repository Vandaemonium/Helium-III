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
- Both legacy lifecycles now guard code-only removal, but use multiple ETAPI operations with a documented check/delete race and deliberately retain config/host notes. They are reference behavior and fixture generators, not a sufficient integration migrator.

## Goals / Non-Goals

**Goals:** share one native feature implementation across desktop/phone; preserve native note identities and approved behaviors; converge hidden configuration and capture setup; make legacy conversion bounded, reviewable and recoverable.

**Non-goals:** implement or deploy in this change; expose Sol publicly; retire stock Trilium/Nootion; add offline queues, reminders, colors or external services; redesign the entire sidebar; build a general module installer; change the underlying app/sync version merely to name a fork release.

## Decisions

### 1. Root presentation is a view, not a data conversion

Add a lazy native Home view for `note.noteId === "root"` in normal view, respecting existing explicit source/attachments/map view precedence and protection handling. Test existing `NoteDetail` transitions so root's underlying book/collection view does not render a duplicate dashboard/list below Home. Other notes, including ordinary books and Render Notes, keep their current rendering.

Do not mutate root type, content, labels, branches or startup-tab state just to display Home. Home is read-only; links go through native note contexts. Disabling the Home presentation returns root to its native view with the original data intact. This avoids a new host note, a root Render Note relation and an irreversible content rewrite.

Port Recent/Pinned/Inbox as native Preact UI and native authenticated data access. Filter hidden/system/generated administrative/protected notes before limits, deduplicate by note ID, cancel or invalidate stale loads, and react to entity/protection changes. Existing configurable global Home pins/Inbox remain distinct from Quick Notes' own pin/archive state. No absent Inbox folder is created.

### 2. Add a stable Quick Notes tab to the existing registry

Extend `RightPaneTabId`/`RIGHT_PANE_TABS` with a localized Quick Notes tab and register its native Preact component in `RightPanelContainer.tsx`. It is available for every actual open note, including root, and does not depend on note type, AI enablement, a Render Note relation or module code. Preserve existing tab IDs, ordering behavior and other panels. Lazy-load the feature rather than pulling an editor bundle into initial startup.

On phones, reuse `MobileNotePanel`'s shared registry/modal, tab bodies, navigation-dismiss callback and safe-area styling. Users open the note panel then Quick Notes; no desktop-style side-by-side promise at phone width. A card navigates the current native context; on phone it dismisses the modal so the editor is visible.

Alternative rejected: a separate phone capture route/host would fork state and recreate the specialized-note experience. Jev selected the existing modal.

### 3. Own drafts outside mounted panel bodies

Use app-window-lifetime, in-memory feature state for composer text, pending operation, uncertainty acknowledgement and selected Active/Archived/search state. Both desktop and phone presentations subscribe to it. Do not store a draft or protected note context in hidden config, localStorage, IndexedDB or a sync option. A window reload can lose a draft, so retain the existing unload warning; cross-window/offline draft persistence is not claimed.

Keep explicit Save, blank rejection, first nonblank line title, escaped native HTML body and the no-blind-retry uncertain-save flow. Opening, closing, resizing or switching panels must not restart an operation. Do not clear newer text when an older save completes. Closing a panel must not call discard. Clear sensitive query/card caches on protection changes and suppress stale responses; drafts are only text explicitly entered by the user, never extracts from the active protected note.

Alternative rejected: component-local state is lost on desktop hard close. Jev selected app-lifetime state. Backend destination/membership/protection checks must accompany UI checks; a stale client cannot write to a newly protected or unrelated destination.

### 4. Hidden feature state, ordinary capture data

Proposed deterministic hidden structure:

| ID | Purpose |
|---|---|
| `_helium` | Hidden feature-state container under `_hidden` |
| `_heliumHomeConfig` | Versioned Home limits/selectors |
| `_heliumQuickConfig` | Versioned Quick Notes `dataNoteId` |
| `_heliumIntegration` | Schema/migration state, approved plan fingerprint and original configuration recovery snapshots |

Use core hidden-subtree definitions and Becca/native note/branch/attribute APIs so entity changes synchronize. Seed configuration once in a transaction; hidden-subtree definitions must not supply enforced default JSON that replaces edited settings. Keep supported settings separate from losslessly retained original config/unknown fields. Client uses internal routes and shared commons types, not imports from core. All core code must run in standalone's worker with no Node imports or `process.env`.

Expose typed presentation options (proposed `heliumHomeEnabled` and `heliumQuickNotesEnabled`, default true) via `OptionDefinitions`, options initialization and ordinary settings. Toggling changes presentation only, not notes/configuration. Persist per-window/sidebar choices using the existing pane options; never use options as a composer store. Config's authoritative destination/selector values live in the hidden notes, not a second independently writable option copy.

Fresh setup creates exactly one normal, unprotected capture folder named `Quick Notes` under root. Pin a deterministic **non-underscore**, core-valid normal note ID for fresh creation, with a deterministic native branch identity and tests for peer convergence; do not use a hidden-system ID for visible user data. The exact ID is an implementation constant, not a display-name lookup. Prefer the legacy folder ID when migrating. Transactional initialization and sync handling must avoid competing fresh IDs, and must not initialize a fresh destination when any unresolved legacy marker exists. Refuse a reserved-ID or unrelated same-name collision instead of claiming it.

Once a destination has been configured, its deletion/protection/hiding produces an actionable error, not automatic recreation. Renaming `Quick Notes — Notes` to `Quick Notes` is previewed; preserve its ID, stored content and child branches. Custom user names require explicit preview resolution. Other user folders are never merged, moved or deleted to meet the one-feature-folder requirement.

### 5. A dedicated core migration, not unattended ETAPI uninstall

Provide authenticated **preview** and **apply** operations in core, available to server/desktop/standalone through the usual internal-route conventions. Preview is strictly read-only. Actual schemas/route names are implementation details to document once chosen; no new public unauthenticated or token-bearing endpoint is required.

Recognize legacy assets using owned, non-inherited metadata plus validated shape and version-specific generated-content fingerprints:

| Legacy feature | Code identity and roles | Retained records |
|---|---|---|
| Home | `heliumModuleId=empyrean.home-panel`; roles `code-root`, `entry-jsx`, `submodule-js` | `heliumModuleConfig=empyrean.home-panel`; `heliumHomeHost=empyrean.home-panel` |
| Quick Notes | `heliumModuleId=empyrean.quick-notes`; roles `root`, `panel`, `boot`, `core`, `adapter`, `view` | `heliumQuickRetained=data/config/host`; config `{schemaVersion:1,dataNoteId}`; host `heliumQuickConfig` relation |

Treat titles as display information, never ownership. Generated-code fingerprints come from trusted supported release artifacts, not a user-supplied module label or a plan that simply lists every matching note. Legacy config can be legitimately customized: validate supported schema, retain original raw values/unknown fields, and copy supported settings before any old config cleanup. Unsupported or protected config blocks apply. Hosts/code modified beyond recognized generated shape block cleanup; do not discard their contents.

Inventory the complete affected graph, including children, parents, clones, incoming/outgoing native relations, content links, launchers and registrations that refer to cleanup candidates. Reject unknown foreign references; do not silently rewrite user notes to redirect them. Include content/attribute/branch state fingerprints, source and target IDs, config transformations, folder rename, removed registrations and each cleanup candidate in the approved digest. Hidden recovery snapshots retain the original config and inventory needed for diagnosis, without capture bodies or credentials in reports/logs.

Jev selected a reviewed exact inventory plus a core transaction and explicit cleanup approval. Existing lifecycle guarded removal is a useful fixture/oracle, but not the apply implementation: its children-first ETAPI loop cannot supply atomic graph validation plus adoption/config/host retirement.

## Migration Plan

### State table

| Observed state | Behavior |
|---|---|
| Neither module, no legacy markers | Seed Home defaults and one visible Quick Notes folder; repeated startup is a no-op |
| Home only | Preserve its settings; approved conversion retires exact Home assets and initializes one fresh Quick Notes destination in the same transaction |
| Quick Notes only | Adopt its existing folder; seed Home defaults; approved conversion retires exact Quick Notes assets |
| Both complete supported modules | Adopt both configs and existing capture folder; retire only approved generated assets |
| Fully removed code with valid retained config/host/data | Explicit retained-only adoption preview; do not require missing code notes to reappear or blindly reinstall a bundle |
| Partial/mixed versions, duplicates, modified assets or conflicts | Block without changes; show IDs/reason and request reviewed resolution |
| Completed migration receipt and matching live state | No new cleanup or folder/config creation; missing/corrupt target is a repair error, not success |

A retained-only state is supported only when its configuration/destination and expected disabled/missing-owned references are fully understood. An otherwise incomplete or ambiguous install does not become a fresh install by default. Do not claim module conversion complete because a label disappeared.

### Apply protocol

1. Operator obtains an application-consistent native backup, verifies restore in an isolated database/build and records the exact build and production instance. No production URL or inventory is inferred from Sirius.
2. Preview reports the graph, transformations, conflicts and digest. VC approves that exact production plan separately. The specification itself does not run or authorize deletion. Keep edit/sync peers quiescent and reload/close existing clients so cached module JavaScript cannot continue writing.
3. Apply acquires the application's supported core write/sync exclusion and starts a native transaction. Recompute the affected inventory/digest **inside** that exclusion. Any drift, duplicate ownership, unexpected descendants/clones/references, changed code fingerprint or missing prerequisite aborts before mutation.
4. Adopt the capture folder by ID; validate every capture's data/metadata/branch invariants. Copy Home settings and Quick Notes destination into hidden config and preserve original config. Seed only the absent feature's defaults. Apply only a previewed stock-folder rename or an explicitly approved name resolution.
5. Remove only owned entry registrations/relations, then exact approved obsolete config/host/code notes in safe leaf order. Destination/captures are never deletion candidates. Each candidate must have no unexpected descendant or reference; a parent deletion must not cascade into user notes. All these steps stay in the same transaction.
6. Write the versioned completion receipt and validate postconditions before commit. Publish/cache-refresh entity changes only consistently with commit; an exception must roll back database **and** in-memory cache state and leave no false success or success notification. Prove this with fault injection rather than assuming SQL rollback repairs Becca.
7. Reopen clients on the new build; verify root Home, desktop/phone capture, one feature folder, no active legacy entry, native editing and backup/restore. Repeating apply is a verified no-op. A conflict stays visible until resolved; do not hide problematic user assets just to get a clean tree.

No app-start destructive conversion, bulk label-based deletion, unattended module reinstall, or direct raw-SQL mutation outside native entity tracking. Failure to demonstrate atomic cache/sync-aware behavior blocks destructive migration; do not silently fall back to the old ETAPI loop.

### Rollback

Before apply, cancellation changes nothing. Failure before commit leaves the full old graph usable and the operator can preview again. After commit, a presentation toggle disables the feature without deleting captured work; it does **not** recreate removed module code/hosts. A full rollback is the rehearsed matching build/database restore. First preserve/export any captures or edits made after the backup, reconcile them explicitly, and keep peers stopped until restore and sync safety are checked. No automatic down-migration, old-module activation, or old-backup overwrite is permitted.

## Test Carryover and Evidence

Keep the existing module sources/tests as supported legacy fixture input until native coverage and migration acceptance are complete. Do not delete tests to turn packaging changes green. On this planning branch no runtime tests have been rerun; Node/pnpm were not on the current shell PATH.

| Existing test source | Native coverage to add / retain |
|---|---|
| `modules/quick-notes/test/core.spec.mjs` | Capture normalization/escaping/title, blank input, pending suppression, newer-draft retention, uncertain-save acknowledgement, scoped ordering/search |
| `modules/quick-notes/test/adapter.spec.mjs` | Authenticated folder-only create, owned pin/archive labels, native current-context opening, unrelated/protected target refusal |
| `modules/quick-notes/test/lifecycle.spec.mjs` | Migration graph refusal, stale approval, edited assets, clones/references/descendants, retained data and rerun; legacy version guard stays a legacy-installer test, not a new built-in app-version restriction |
| `modules/quick-notes/test/package.spec.mjs` and `transport.spec.mjs` | Keep inert ZIP/reproducibility and raw-HTML ETAPI behavior for supported old fixtures; add proof new feature does not need a note package or ETAPI credentials |
| `modules/quick-notes/test/browser.mjs` | Native desktop/375px capture, cards, native editing and keyboard/touch plus hard-close/reopen, tab switch, peek and modal draft/pending cases |
| `modules/quick-notes/test/integration.mjs` | New isolated fork-build integration harness for fresh/Home-only/Quick-only/both/retained-only installs and full rollback/backup restore; never point fixture tooling at Sol |
| `modules/home-panel/test/lifecycle.spec.mjs` | Home selectors/config defaults/protected exclusion and lifecycle graph regressions; new root-view, root-data preservation, filter-before-limit and entity/protected-session refresh assertions |
| Existing `NoteDetail`, `RightPanelContainer`, `RightPaneTabs`, `MobileNotePanel` specs | Root/alternate-view transitions, stable tab selection and AI-independent availability, mobile shared registry/native navigation and draft lifecycle |
| Core/server/standalone suites | Hidden initialization preserving edits, deterministic peer convergence, cache rollback/sync events, exact migration inventory and transaction/fault injection |

Crew runs the narrowest native suites per changed area; core tests run through **both server and standalone** configurations, then `pnpm typecheck` once when implementation is ready. Follow `CLAUDE.md`: no ESLint, no development-wide `test:all`/whole-package coverage, no guessed raw `tsc` invocation. Existing legacy pure tests can still be run with `node --test modules/quick-notes/test/*.spec.mjs modules/home-panel/test/*.spec.mjs` when the documented Node runtime is available.

Implementation must add English catalogue keys, matching component CSS, ordinary User Guide pages and a `.changelog` entry, plus fork release notes describing the packaging break, migration-pending state and rollback. Update legacy README installation guidance to discourage activation on a migrated integrated build. Physical-phone and VC acceptance remain separate from viewport emulation. Opus crew opens a **draft implementation PR** for VC; this planning branch is not a production release.

## Risks / Trade-offs

- [Hidden config generation overwrites edits] → seed-once configuration, no enforced default JSON, restart/sync regression coverage.
- [SQL rollback leaves stale cache or emitted changes] → use existing transaction/exclusion patterns and fault-inject cache/sync rollback; block apply until proven.
- [New/old build sync peer disagreement] → quiesce peers for migration, upgrade/reload them as a coordinated reviewed step; do not let old clients keep module code live.
- [Protected notes leak via late responses] → filter before summaries, invalidate generations/caches, test unlock/lock/protect while requests are in flight.
- [Legacy links to retired hosts break] → include link/launcher/reference scans; unresolved references block deletion and require a separately previewed resolution.
- [Fresh independent peers create competing folders] → deterministic normal data ID/branch plus hidden config identity; explicitly test reconciliation and reject migration-vs-fresh conflicts.
- [App-lifetime drafts vanish on full reload] → existing unload warning, explicit Save and no misleading persistent/offline-draft promise.

## Open Questions for VC / Release Gates

The approach above uses the recommended answers; these are explicit approval checkpoints, not unfilled technical design choices. If VC chooses differently, revise affected specs/tasks before implementation acceptance.

1. **Phone surface:** approve Quick Notes in the existing note-panel modal rather than a persistent side column? **Recommend yes**; this reuses the inspected mobile layout and shared tab state. Jev agrees.
2. **Destructive production cleanup:** no blanket permission is sought here. Will VC approve the exact generated inventory after isolated rehearsal and backup/restore evidence? **Recommend preview first, then approve only conflict-free exact assets**; never auto-remove unknown descendants or user-edited hosts. Jev agrees.
3. **Ambiguous installed state:** actual Sol IDs, renamed folders and external links are not known from the brief. **Recommend have Houston/crew obtain a read-only preview under separate access, preserve all conflicts and ask VC only for the specific mapping/name/reference resolution** rather than guessing now.
4. **Decision-source reconciliation:** the named evening canonical section was absent from this mirror and then the file became unavailable. **Recommend Claude verify the original section against this brief before sign-off**; missing replica content is not a reason to invent or reverse VC's decisions.
