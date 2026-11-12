# Helium-III Module: `empyrean.home-panel` (v0.1.0)

Independently installable and removable personal Home panel module for **Helium-III** (`notes.empyrean.cc`), built according to OpenSpec change `home-widget-module-v1` (Option A: versioned note-subtree package).

## Features
- **Pinned Notes**: Displays user notes tagged `#pinned` (configurable via `Home Panel Config`).
- **Inbox Preview**: Displays notes inside `#inbox` folders or tagged `#inbox`.
- **Recent Notes**: Displays recently modified user notes while filtering out hidden/system notes (`_hidden`), archived notes, protected notes, and module code/config notes. Protected notes are excluded from all three lists, even with an open protected session.
- **Standalone + Dashboard Ready**: Works as a standalone Render Note (`Home`) or as an interactive child widget dragged/cloned into a native Trilium Dashboard collection.
- **Strict Code vs. User Data Separation**:
  - Owned executable code notes (`#heliumModuleId="empyrean.home-panel"`) live under `root` by default (`codeParentNoteId`). Trilium refuses new children of `_hidden`.
  - User configuration (`#heliumModuleConfig="empyrean.home-panel"`) and the user's `Home` host note (`#heliumHomeHost="empyrean.home-panel"`) live outside the code subtree and are **never deleted** on module uninstall or overwritten on upgrade.

## Layout
- `manifest.json` — Machine-readable module contract (`moduleId`, `version`, `compatibleTriliumRange`, `entryPoints`, `ownedCodeNotes`, `retainedDataNotes`).
- `src/package_root.html` — Module code root description.
- `src/HomePanelRoot.jsx` — Preact/JSX Render Note entry point (`text/jsx`) with `@scope`-friendly local CSS.
- `src/HomePanelQueries.js` — Child frontend JS submodule (`application/javascript;env=frontend`) providing config normalization and read-only note queries.
- `scripts/build-package.mjs` — Deterministic builder producing `dist/empyrean.home-panel-0.1.0.zip` (`!!!meta.json` + code subtree).
- `scripts/lifecycle.mjs` — ETAPI CLI and programmatic lifecycle controller (`install`, `activate`, `disable`, `uninstall`, `upgrade`).
- `test/lifecycle.spec.mjs` — Automated 5-stage lifecycle & data-preservation test suite.

## Commands

Build the importable ZIP artifact:
```bash
node modules/home-panel/scripts/build-package.mjs
```

Run the 5-stage lifecycle verification suite:
```bash
node --test modules/home-panel/test/lifecycle.spec.mjs
```

Run lifecycle actions against `notes.empyrean.cc` via ETAPI. `HELIUM_URL` must be HTTPS, or plain HTTP on a loopback address only; redirects are refused.
```bash
export HELIUM_URL="https://notes.empyrean.cc"
export HELIUM_ETAPI_TOKEN="<your-etapi-token>"

# 1. Inert install (sets ~disabled:renderNote until activated)
node modules/home-panel/scripts/lifecycle.mjs install

# 2. Activate (~disabled:renderNote -> ~renderNote)
node modules/home-panel/scripts/lifecycle.mjs activate

# 3. Disable (~renderNote -> ~disabled:renderNote); reload clients before removal
node modules/home-panel/scripts/lifecycle.mjs disable

# 4. Code-only uninstall: preview the plan, then approve its hash during a maintenance window
node modules/home-panel/scripts/lifecycle.mjs preview-uninstall
node modules/home-panel/scripts/lifecycle.mjs uninstall <approvalHash> --maintenance-confirmed

# 5. Upgrade / reinstall: the same preview and approval, then a fresh inert install
node modules/home-panel/scripts/lifecycle.mjs preview-uninstall
node modules/home-panel/scripts/lifecycle.mjs upgrade <approvalHash> --maintenance-confirmed
```

### Removal safety

Uninstall and upgrade use the same guarded protocol as `empyrean.quick-notes`. The plan is refused, and nothing is deleted, when:
- the owned code inventory is not exactly the three roles (`code-root`, `entry-jsx`, `submodule-js`), once each;
- a code note is protected, cloned (more than one parent) or holds a user note as a child;
- any note other than the Home host references the code, or the host still has an active `~renderNote`.

The approval hash covers each code note's content blob, title, type, MIME, parents, children and attributes, so a changed graph invalidates an approved plan. Notes are deleted children-first, each rechecked right before its delete; the server's recursive delete is never relied on. ETAPI has no atomic conditional delete, so a concurrent writer can still race the last recheck: stop editing and sync peers for the maintenance window.

Activation, disabling and install only change `~renderNote` / `~disabled:renderNote` relations on the Home host that target Home-owned code; any other target is refused. Duplicate config or host notes are refused rather than picked arbitrarily. A partial install (interrupted mid-sequence) leaves an incomplete inventory that the plan refuses: remove it by hand after checking it holds no user notes.
