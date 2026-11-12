# empyrean.quick-notes v0.1.0

Development artifact for Helium-III. VC approved the OpenSpec scope/defaults on 2026-11-12. Implementation is not yet approved for personal release or installation on the production instance.

## Features and boundaries

- Explicit text capture with first nonblank line as title, safely escaped native text-note body and confirmed-save feedback.
- Responsive cards, pin/unpin, separate Active/Archived views, restore, and case-insensitive title/body search in the selected view.
- Cards navigate the current native editor context. Native rich text is previewed as text, never rewritten by the board.
- Scope is direct native text-note children of the dedicated Quick Notes data folder. Other note types and all protected notes (even unlocked ones) are excluded. A protected destination is refused instead of silently downgrading encryption.
- Pin/archive are non-inherited `heliumQuickPinned`/`heliumQuickArchived` labels with `true`/`false` values, not global pin/archive/Inbox conventions.
- No Home-module dependency, backend scripting, embedded credentials, external assets, checklist/color/reminder features or offline queue.
- Unsaved drafts live only in memory across native navigation, with a browser-unload warning. Pending capture freezes the composer and blocks duplicate clicks. An uncertain save keeps the draft and disables retry until the user explicitly acknowledges checking the existing notes. There is no automatic create retry or claim of transactional exactly-once delivery.

## Build and tests

From the repository root, using Node 26:

    node --test modules/quick-notes/test/*.spec.mjs
    node modules/quick-notes/scripts/build-package.mjs
    npm ci --prefix modules/quick-notes/test-tools --no-audit --no-fund
    node modules/quick-notes/test/browser.mjs

The browser harness uses `/usr/bin/chromium`. Test tooling is separate from the shipped note package; the ZIP and lifecycle builder have no third-party Node dependency.

For the real integration harness, set `HELIUM_TEST_RUNTIME` to the extracted upstream Linux-x64 server distribution, then run:

    node modules/quick-notes/test/integration.mjs

The harness starts an authenticated loopback-only server on port 18174 with a fresh, retained synthetic database under `/home/vc/plans/notes-app/quick-notes-fixture-<timestamp>`. It refuses an existing initialized database. Secrets are generated/used in memory and never printed or written by the harness. Backend scripting stays disabled. By default it stops after disable and a removal preview. Only after explicit authorization for synthetic code deletion, add `--allow-test-code-removal` to exercise deletion of the six generated code notes and retained-state reinstall. No fixture directories are erased.

## Lifecycle (operator-run, approval required)

Use the lifecycle helper for installation; it imports the generated inert ZIP and creates separate retained data/configuration/host notes. A UI ZIP import alone does not configure a host and is not the documented installer.

The operator supplies `HELIUM_URL` and securely loads `HELIUM_ETAPI_TOKEN` into the process environment. Never put credentials in the package, docs, shell history or PR. The lifecycle helper runs outside the module and has powerful ETAPI access; frontend code holds no ETAPI token. Only HTTPS or loopback HTTP is accepted, and redirects are refused.

    node modules/quick-notes/scripts/lifecycle.mjs install
    node modules/quick-notes/scripts/lifecycle.mjs activate

`install` imports code under native `root`, not the read-only virtual `_hidden` root. It creates a retained data folder, JSON config (`schemaVersion: 1`, `dataNoteId`), and Render Note host with an inert `disabled:renderNote` relation. Activation is explicit/idempotent; reload clients after activation or disable. The version guard permits only 0.107.0; this is not proof that every fork with that version was tested.

For disable/recovery:

    node modules/quick-notes/scripts/lifecycle.mjs disable

Reload every client and return to native notes. Disable retains code/data/config. No server configuration change or native-data restore is needed to stop this UI module.

For removal, first obtain an application-consistent backup, stop editing/sync peers for an exclusive maintenance window, disable/reload all clients, and preview:

    node modules/quick-notes/scripts/lifecycle.mjs preview-uninstall

Ask VC to approve the exact plan. Only then:

    node modules/quick-notes/scripts/lifecycle.mjs uninstall <approved-plan-sha256> --maintenance-confirmed

This keeps the data folder, notes, scoped labels, config and host. It refuses incomplete/duplicate code inventories, unexpected descendants, shared clones, external references, active entry points, and plan/asset drift. Each leaf is rechecked before removal. These checks are NOT an atomic server-side graph lock: a concurrent change between the final check and ETAPI DELETE remains a risk. Production removal remains blocked pending independent data-integrity review and acceptance of the maintenance protocol or a transactional adapter. Never run unattended removal/upgrade. A partial failure stops; inspect the remaining code and do not blindly re-import or delete the parent subtree.

Reinstall after a completed approved code-only removal reuses retained configuration, folder and host. There is no automatic in-place upgrade or downgrade; future version replacement requires a separately reviewed recovery procedure.

See `verification.md` for exact evidence and remaining release gates.
