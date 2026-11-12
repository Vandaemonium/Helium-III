## 1. Proposal Approval
- [x] 1.1 Record VC's feature selection and online desktop/phone scope; inspect existing OpenSpec context and consult Jev.
- [x] 1.2 Obtain VC approval of this proposal and the proposed defaults before implementation (VC: “approve”, 2026-11-12).

## 2. Target and Design Verification
- [ ] 2.1 Verify the exact fork/runtime build, supported authenticated frontend create/search/metadata APIs, Render Note execution and mobile behavior on an isolated synthetic database; record source/build identifiers and tested compatibility only.
- [x] 2.2 Review native capture/collection reuse and define retained folder/config/host locations, scoped labels, package ownership, shared-reference checks and failure recovery. Reuse lifecycle code only after auditing actual upstream deletion semantics.

## 3. Implementation After Approval
- [x] 3.1 Write failing tests for capture, escaping, pending/uncertain saves, card previews, scoped search, ordering and retained pin/archive state.
- [x] 3.2 Implement the text composer, responsive card board, native-edit navigation, archive view and title/body search without backend scripting or embedded credentials.
- [x] 3.3 Build the versioned inert package and lifecycle actions with explicit activation, safe disable/reload, deletion preview/consent, guarded code-only uninstall and retained-state reinstall.

## 4. Release Gates
- [x] 4.1 Run unit/adapter tests including network failures, empty/markup text, duplicate clicks, unrelated/locked notes, unexpected descendants and shared references.
- [ ] 4.2 Exercise the real imported package on an isolated target: install -> activate -> capture -> native edit -> pin/archive/search -> disable/reload -> approved code-only uninstall -> reinstall; verify notes/configuration survive and unrelated features remain unchanged.
  - Passed on isolated upstream v0.107.0 `d83d7151f1` with retained synthetic data; exact Helium-III target and unrelated-feature acceptance remain open.
- [ ] 4.3 Verify keyboard/focus and online phone layout at 375 CSS pixels; test a real phone browser before claiming phone acceptance.
  - Desktop keyboard/focus, 375px layout and mobile-UA capture passed in Chromium. Physical-phone acceptance remains open.
- [ ] 4.4 Complete independent integration/security/data review and VC usability acceptance; record any blocker rather than substituting fixture tests for browser/runtime evidence.
  - Frontend Jev check marked `jev_unsure`; not independent approval. Lifecycle Jev check permits a draft PR only with documented maintenance-only removal. ETAPI has no atomic graph-lock/conditional-delete guarantee; independent data-integrity review is a production blocker.
- [ ] 4.5 Publish the verified artifact, compatibility/rollback evidence and Houston handoff as needed. Install on the personal instance only after approval and an application-consistent backup; obtain VC approval before any deletion.
