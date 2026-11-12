# Tasks: Integrate Home and Quick Notes

Status: specification only. Every checkbox below is implementation/review work, not a claim that it has run. Use `design.md` for the architecture and legacy-test mapping. Owner: Claude's Opus crew; VC approves the draft implementation PR. Houston owns separately approved Sol maintenance.

## 1. Confirm Inputs and Preserve the Baseline

- [ ] 1.1 Reconcile Claude's brief with the exact `2026-11-12 evening` canonical decision section and record its source; verify the named Home/root, sidebar, hidden-config and capture-folder decisions match before implementation sign-off. If sources disagree, stop for VC rather than infer a new decision from a stale/missing mirror.
- [ ] 1.2 Fetch and compare `release/v0.1.0` against inspected `afb3358e2520f5dd369824fc4980b9bd1b4ba743`; record the selected base/build and review any new module/lifecycle fixes. Verify the implementation branch includes them without rewriting published history.
- [ ] 1.3 Record VC review of the proposed phone modal and app-lifetime draft state (VC approved the phone modal on 2026-11-12); revise the specs if VC rejects a proposed default.
- [ ] 1.4 Turn the design's test-carryover table into an implementation coverage ledger. Verify every old behavior/safety assertion is ported to native coverage and every retired packaging-only assertion is dropped; do not retain executable note bundles or supported installers to preserve tests.

## 2. Hidden State and Repeatable Native Setup

- [ ] 2.1 Add versioned hidden `_helium...` configuration definitions, shared commons types and seed-once setup using native sync-aware entities. Verify fresh/restart/edit-preservation/malformed-config tests in both server and standalone and document the hidden schema/defaults.
- [ ] 2.2 Implement the single visible native capture destination, deterministic fresh note/branch identities. Verify repeated initialization, deterministic IDs, same-name conflicts and leftover module notes create no duplicate or hijacked folder; document setup/recovery behavior in the User Guide.
- [ ] 2.3 Add typed presentation options and their initialization/settings integration without duplicating authoritative hidden config or storing drafts. Verify toggling hides presentation only, restores root's native view when disabled, and leaves capture data/config intact; add English strings and help text.
- [ ] 2.4 Add authenticated native setup/config/capture access as needed, with server-side membership/destination/protection checks and no frontend core import, raw DB bypass, ETAPI secret or Node-only core API. Verify corresponding narrow server/standalone route/service tests and document the actual chosen internal contracts.

## 3. Built-In Root Home

- [ ] 3.1 Add lazy native root Home selection in `NoteDetail.tsx`/`note_types.tsx`, with tests for normal root, existing alternate views, root content/metadata preservation and ordinary book/Render Note behavior. Verify the root's collection/list is not duplicated below Home.
- [ ] 3.2 Port Recent/Pinned/Inbox selectors and configurable limits into native data access/UI, filtering before limits and deduplicating Inbox candidates. Verify defaults/custom selectors, pinned-vs-Quick-pin separation, absent Inbox, archived policy, and dense excluded Recent candidates in targeted tests.
- [ ] 3.3 Add entity/protected-session refresh, stale-result invalidation, safe title rendering, native links and loading/error/empty states. Verify protected notes are excluded even unlocked, no protected identifiers/count contributions persist, and keyboard/touch navigation works; add scoped CSS, English strings, root-Home User Guide content and its `.changelog` entry.

## 4. Quick Notes Desktop and Phone UI

- [ ] 4.1 Add a stable localized Quick Notes tab in `RightPaneTabs.tsx` and its lazy registration in `RightPanelContainer.tsx`. Verify native sidebar tests cover root/text/PDF/image/protected current notes, AI disabled and preservation of existing pane tabs/options.
- [ ] 4.2 Implement the shared app-window-lifetime in-memory composer/controller and explicit-save flow, carrying over capture escaping/title/blank/pending/uncertain/newer-draft assertions. Verify native tests cover tab switch, peek dismissal, hard close/reopen and pending remount without extra creation or draft loss; retain unload warnings and no automatic retry.
- [ ] 4.3 Port eligible direct-child cards, native current-context editing, scoped pin/archive/restore/search and protected/destination checks. Verify rich-text round trips, pinned/modified/tie ordering, Active/Archived body search, unrelated/nested/other-type preservation and protection/destination change races with the mapped native tests.
- [ ] 4.4 Reuse `MobileNotePanel` and shared tab state; wire native card navigation to modal dismissal. Verify 375px automated phone-layout cases, modal close/reopen draft/pending state, touch targets, safe areas and no horizontal overflow; add mobile/desktop User Guide steps, English strings, matching component CSS and a `.changelog` entry. Do not claim a physical-phone test from emulation.
- [ ] 4.5 Retire Home/Quick Notes module packaging, builders, executable-note payloads and install/activate/uninstall commands after native behavior coverage is ported; keep only historical Git references. Verify the compiled build works on a database with no modules, creates no feature Render/code/host notes, has no feature package/lifecycle entry points in the distribution, and documents built-in use rather than module installation. This is implementation work, not permission to delete production notes.

## 5. Legacy Migration — dropped

Dropped by VC on 2026-11-12 (Sol only has test data). The built-in features ignore leftover module notes and never touch them; see `proposal.md`, Decision Provenance.

## 6. Cross-Feature Rehearsal and Review

- [ ] 6.1 Run the ported behavior/safety tests with the narrow native client/server/standalone suites for changed areas; run `pnpm typecheck` once after the implementation is ready. Verify real results are recorded, no guessed counts or missing-runtime substitutes, no ESLint/full development suite, no installer/package-build runtime dependency, and no old module test claims treated as native acceptance.
- [ ] 6.2 Smoke-run the fork build on a fresh isolated database. Verify root Home, the sidebar Quick Notes tab, a capture landing in the Quick Notes folder, and that no module or feature Render/code/host notes are created.
- [ ] 6.3 Rehearse native backup/restore with synthetic captures; verify content/metadata/config integrity. Record build IDs and exact evidence.
- [ ] 6.4 Update fork release notes/User Guide/changelog with the new built-in entry points, hidden-not-encrypted semantics, fresh setup, preserved behavior and compatibility limits. Verify docs agree with the implemented routes/options and describe packaging changes without implying a release/deploy already happened.
- [ ] 6.5 Obtain independent data-integrity review plus physical-phone and VC acceptance; verify approval of the proposed mobile surface and exact observed behavior is recorded separately from emulator results. Open an Opus draft implementation PR with its evidence and unresolved gates; keep it draft until VC reviews.

## Workflow Follow-up

- After implementation acceptance, reconcile/archive superseded module change packaging requirements without marking unrelated unfinished release/deployment tasks complete. Validate the archived canonical specs before treating them as the active contract.
- Removing leftover module notes from Sol is separate, manual, VC-approved maintenance; nothing in this change deletes them.
- Production deployment, public endpoint/DNS work, release tagging and unrelated app retirement stay separately approved operational work; nothing here schedules or executes them.
