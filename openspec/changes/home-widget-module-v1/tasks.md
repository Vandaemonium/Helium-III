## 1. Module Contract & Source Layout
- [ ] 1.1 Create `modules/home-panel/manifest.json` defining `moduleId` (`empyrean.home-panel`), `version` (`0.1.0`), `compatibleTriliumRange` (`>=0.104.0 <=0.107.x`), owned code note paths, and retained user config path.
- [ ] 1.2 Implement the Preact/JSX Render Note bundle (`modules/home-panel/src/`) rendering Recent Notes, Pinned Notes (`#pinned`), and Inbox preview with scoped CSS (`#appCss` / local styles).
- [ ] 1.3 Write the lifecycle helper script/instructions for install, activation, disable, code-only uninstall, and replacement upgrade.

## 2. Verification & Review Gates
- [ ] 2.1 Test full lifecycle against synthetic fixtures: install -> activate -> disable -> uninstall code only (verifying retained user config and `#pinned`/`#inbox` notes remain intact) -> reinstall.
- [ ] 2.2 Run independent code/security/data-integrity review on the PR in `Vandaemonium/Trilium` before installing on `notes.empyrean.cc`.
