# Independently Installable Home Widget Module (Option A) for Helium-III

## Why
VC's primary modularity goal for **Helium-III** is independently installable and removable feature modules (where removing a module removes its code/registrations without deleting user notes or configuration). VC selected Option A for the first module: a versioned note-subtree package delivering a personal Home panel (Recent Notes, Pinned Links, and Inbox preview) that proves the full module lifecycle without rewriting Trilium core.

## What Changes
- Define the v1 note-subtree module package contract (`manifest.json` + code bundle subtree imported under `_hidden` or a designated modules parent, strictly separated from user configuration/data notes).
- Build the `empyrean.home-panel` v0.1.0 module for **Helium-III** using Render Note (`~renderNote`, Preact/JSX) and script bundle (`module.exports`) mechanisms to display Recent Notes, Pinned Notes (`#pinned`), and Inbox preview (`#inbox`), compatible with placement inside a native Dashboard collection or standalone Home note.
- Implement and verify the five-stage lifecycle: inert import/install -> reviewed activation -> disable -> code-only uninstall (retaining user data/config) -> clean upgrade/reinstall.

## Impact
- Affected specs: `home-widget-module`
- Affected code: Packaged under `modules/home-panel/` in **Helium-III** (`Vandaemonium/Trilium` / `Vandaemonium/Helium-III`, exported as an importable note-subtree ZIP package plus lifecycle CLI/tests); no destructive core schema changes.
