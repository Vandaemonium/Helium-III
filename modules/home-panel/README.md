# Helium-III Module: `empyrean.home-panel` (v0.1.0)

Independently installable and removable personal Home panel module for **Helium-III** (`notes.empyrean.cc`), built according to OpenSpec change `home-widget-module-v1` (Option A: versioned note-subtree package).

## Features
- **Pinned Notes**: Displays user notes tagged `#pinned` (configurable via `Home Panel Config`).
- **Inbox Preview**: Displays notes inside `#inbox` folders or tagged `#inbox`.
- **Recent Notes**: Displays recently modified user notes while filtering out hidden/system notes (`_hidden`), archived notes, and module code/config notes.
- **Standalone + Dashboard Ready**: Works as a standalone Render Note (`Home`) or as an interactive child widget dragged/cloned into a native Trilium Dashboard collection.
- **Strict Code vs. User Data Separation**:
  - Owned executable code notes (`#heliumModuleId="empyrean.home-panel"`) live under `_hidden` (or the import target).
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

Run lifecycle actions against `notes.empyrean.cc` via ETAPI:
```bash
export HELIUM_URL="https://notes.empyrean.cc"
export HELIUM_ETAPI_TOKEN="<your-etapi-token>"

# 1. Inert install (sets ~disabled:renderNote until activated)
node modules/home-panel/scripts/lifecycle.mjs install

# 2. Activate (~disabled:renderNote -> ~renderNote)
node modules/home-panel/scripts/lifecycle.mjs activate

# 3. Disable (~renderNote -> ~disabled:renderNote)
node modules/home-panel/scripts/lifecycle.mjs disable

# 4. Code-only uninstall (removes code subtree, preserves user config & notes)
node modules/home-panel/scripts/lifecycle.mjs uninstall

# 5. Upgrade / reinstall (replaces code subtree, preserves user config)
node modules/home-panel/scripts/lifecycle.mjs upgrade
```
