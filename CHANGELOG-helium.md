# Changelog — Helium-III

All notable changes to the Helium-III fork (`Vandaemonium/Helium-III`) are documented in this file.
Upstream TriliumNext/Trilium changes prior to the fork baseline are documented in upstream release notes.

---

## [v0.1.0] — unreleased

### Baseline Fork
- **Fork Baseline:** Established Helium-III fork from TriliumNext/Trilium v0.107.0 (commit `55c8d2f`).
- **OpenSpec Integration:** Added in-repo OpenSpec change tracking under `openspec/changes/`.
- **Sol Deployment Topology:** Specified isolated deployment architecture for `notes.empyrean.cc` using a dedicated container (`trilium-notes`) and fresh database (`~/docker/config/trilium-notes`), fully decoupled from stock Trilium (`trilium.empyrean.cc`).

### Built-in features
- **Home:** opening the root note shows Recent, Pinned (`#pinned`) and Inbox (`#inbox`) sections. Protected notes are excluded even while unlocked. Configured in the hidden note `_heliumHomeConfig`; turned off in *Options → Other*.
- **Quick Notes:** a right-sidebar tab (and a note-panel tab on phones) with explicit Save, first-line titles, escaped capture, cards, pin/archive/restore and scoped search. Captures are ordinary text notes in the visible `Quick Notes` folder (`heliumQuickNotes`); configuration lives in the hidden note `_heliumQuickConfig`. Protected notes and protected destinations are refused.

### Interface
- **Density:** *Options → Appearance → Density* with *Compact* (default) and *Comfortable*. Compact shortens the tab bar, launch bar, tree rows and note header, scales text to 92–95% unless the user set font sizes, and narrows a note tree still at the old 25% default to 20%.
- **Fixes:** Home no longer shows the text formatting toolbar or note type switcher above it; Quick Notes cards are one compact row with icon pin/archive buttons.

### Removed
- **Module packaging:** the `empyrean.home-panel` and `empyrean.quick-notes` note-subtree modules, their ZIP packagers and ETAPI lifecycle scripts (`modules/`) are removed; both features are now app code (VC, 2026-11-12). No migration from installed modules: leftover module notes are ignored and can be deleted by hand.
