# Quick Notes v1 — independently installable capture and card board

## Why
VC selected Increment 2, option B (Quick Notes), then explicitly chose text capture, cards, pin/archive and search for desktop and phone browsers online. The feature must remain independently installable/removable and retain ordinary user notes when disabled or uninstalled.

## What Changes
- Propose `empyrean.quick-notes` v0.1.0 as a versioned note-subtree module, independently usable without `empyrean.home-panel` and without a core schema change.
- Provide a text composer, a responsive card board, pin/unpin, archive/unarchive, and search limited to Quick Notes. Archived notes have an explicit view and remain recoverable; archiving never deletes notes.
- Keep captured notes as ordinary native text notes, with pin/archive state and configuration outside the owned code subtree. Open cards in the native editor rather than build a competing rich-text editor.
- Prove inert install, explicit activation, disable/reload, code-only uninstall, and retained-state reinstall using synthetic fixtures and a real isolated target build before personal release.

## Approved Scope and Defaults
Confirmed scope: text capture, cards, pin/archive and search; online desktop and phone browsers.
VC approved the following defaults with “approve” on 2026-11-12:
- A dedicated retained Quick Notes folder, separate from the global Inbox; no existing notes are moved or relabeled automatically.
- Explicit Save for new captures, with pending/success/failure feedback and preserved draft text after a failed save; no background autosave or offline queue in v1.
- First nonblank line supplies the title; an empty/whitespace-only draft is rejected; the remaining text is preserved in the body with safe text-to-HTML conversion.
- Active view shows pinned cards first, then most recently modified; Archived is separate. Search matches title and text body in the currently selected view, including archived notes only in Archived.
- Pin and archive use module-scoped retained metadata, with no automatic edits to global `#pinned`, `#archived`, `#inbox`, publishing or protection settings.
- Existing note editing uses the native editor. No custom checklist, formatting or attachment editor.

## Non-Goals
Checklists, card colors, reminders, offline capture, collaboration, OS/global shortcuts, browser extensions, external integrations, Markdown mirror, a generic module manager, and changes to the existing Home module are outside this increment. Rich-text notes edited natively must not be flattened by card previews.

## Impact
- Affected specs: `quick-notes-module` (new capability).
- Expected implementation area after approval: `modules/quick-notes/` plus this OpenSpec change. Do not assume the existing Home lifecycle implementation is safe to copy without ownership/deletion review.
- Runtime permissions: logged-in frontend authority only; no backend scripting, embedded ETAPI credentials, third-party services or external network assets. These are design constraints, not a claim of sandbox isolation.
- Compatibility: declare only the exact fork build actually exercised; do not inherit an untested upstream version range.
- Deployment: baseline `notes.empyrean.cc` rollout remains separate. Houston owns any server/container changes; no module installation, deletion or production note writes occur as part of this proposal.

## Decision and Approval Status
VC confirmed feature scope and online desktop/phone support. Jev recommended the independent ordinary-note design; Jev is advisory, not VC approval. VC approved this proposal and its defaults on 2026-11-12, authorizing implementation on a separate branch. Runtime release, installation and any deletion remain separate gates; no release is claimed here.
