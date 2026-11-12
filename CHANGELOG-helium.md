# Changelog — Helium-III

All notable changes to the Helium-III fork (`Vandaemonium/Helium-III`) are documented in this file.
Upstream TriliumNext/Trilium changes prior to the fork baseline are documented in upstream release notes.

---

## [v0.1.0] — 2026-11-12

### Baseline Fork
- **Fork Baseline:** Established Helium-III fork from TriliumNext/Trilium v0.107.0 (commit `55c8d2f`).
- **OpenSpec Integration:** Added in-repo OpenSpec change tracking under `openspec/changes/`.
- **Sol Deployment Topology:** Specified isolated deployment architecture for `notes.empyrean.cc` using a dedicated container (`trilium-notes`) and fresh database (`~/docker/config/trilium-notes`), fully decoupled from stock Trilium (`trilium.empyrean.cc`).

### Modules
- **Home Panel Module (`empyrean.home-panel` v0.1.0):**
  - Personal Home overview panel implemented as a Preact/JSX Render Note (`HomePanelRoot.jsx`) with `@scope` styles and query helper (`HomePanelQueries.js`).
  - Displays Recent Notes, Pinned Notes (`#pinned`), and Inbox preview (`#inbox`).
  - Usable as a standalone Home Render Note or embedded as a widget in a native Dashboard collection.
  - Strict separation of module code from retained user configuration and user notes.
- **Quick Notes Module (`empyrean.quick-notes` v0.1.0):**
  - Lightweight text capture composer with explicit Save button, safe HTML escaping, and preserved in-memory drafts on failure.
  - Responsive card grid supporting desktop screens and 375 CSS-pixel mobile viewports.
  - Scoped title and body search across Active and Archived views.
  - Reversible pin and archive actions using scoped attributes (`heliumQuickPinned`, `heliumQuickArchived`) without altering global note tags.
  - Native editor navigation directly from cards (`api.activateNote`) with safe text previews of rich-text content.
  - Dedicated storage folder outside the global Inbox; strict exclusion of all protected notes and destinations.
  - *Status:* Implementation on draft PR #4 (`0da8091`); production installation held for open release gates.

### Tooling & Packaging
- **Note-Subtree Module Contract:** Defined versioned package contract (`manifest.json`) and deterministic ZIP packagers for note-subtree modules.
- **Operator Lifecycle CLI:** Added 5-stage ETAPI lifecycle management scripts (`install`, `activate`, `disable`, `uninstall`, `upgrade`) featuring guarded code-only uninstalls that preserve user notes, configurations, and metadata.
