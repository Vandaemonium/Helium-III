## Purpose

Upgrade installed note-subtree Home and Quick Notes modules into built-in features without losing captures, configuration or unrelated user data.

## ADDED Requirements

### Requirement: Read-Only Exact Migration Preview
Before changing a legacy installation, migration SHALL inventory owned labels, roles, configuration, destination references, parent/child branches, clones, external references and active registrations. It SHALL present the exact adoption, rename, hidden-configuration copy, registration changes and cleanup note IDs with a digest bound to that state. Names or module labels alone SHALL NOT prove an asset is disposable.

#### Scenario: Preview both installed modules
- **WHEN** an operator previews the installed Home and Quick Notes modules
- **THEN** the report identifies each generated asset and retained destination, distinguishes user captures from cleanup candidates, reports conflicts and backup/maintenance prerequisites, and changes no notes or registrations

### Requirement: Lossless Adoption Before Cleanup
Migration SHALL validate and preserve supported Home settings and the Quick Notes destination reference, adopt the existing capture folder in place and retain all captured notes and scoped metadata. Original configuration and unknown fields SHALL be retained losslessly in hidden recovery state before visible legacy configuration is retired. Cleanup SHALL not start until the adopted destination and configuration are verified.

#### Scenario: Preserve real captured work
- **WHEN** an approved migration is applied to a valid installation with rich-text captures, pin/archive labels and additional user notes under the capture folder
- **THEN** every capture retains its ID, body, metadata, timestamps and original branches, other children remain intact, and the built-in feature reconnects to the same folder

#### Scenario: Unreadable or unsupported configuration
- **WHEN** legacy configuration is malformed, protected, unsupported or points to a missing, hidden or protected destination
- **THEN** migration refuses changes with a recovery explanation instead of dropping settings, guessing a destination or creating a replacement folder

### Requirement: Explicit Operator Approval and Exclusive Apply
Applying legacy migration SHALL require approval of the current preview digest, a verified application-consistent backup and an exclusive maintenance window with editing/sync peers quiesced. Apply SHALL revalidate the complete affected graph under the core write transaction and reject a stale digest. Installing/upgrading the application alone SHALL NOT authorize production cleanup.

#### Scenario: The graph changes after approval
- **WHEN** a note, branch, config value, content hash or reference in the approved inventory changes before apply
- **THEN** apply refuses the stale plan without partial migration and requires a new preview and approval

#### Scenario: Upgrade with no cleanup approval
- **WHEN** an existing installation starts the new app without an approved migration plan
- **THEN** no legacy asset is deleted, no competing capture destination is created, and the UI reports migration pending rather than claiming a clean conversion

### Requirement: Bounded Cleanup Without Cascading User Deletion
Cleanup SHALL retire only exact verified generated code/config/host notes and owned registrations. Captured notes and their destination SHALL never be cleanup candidates. Foreign descendants, cloned/shared generated assets, edited host/code assets and external references SHALL block destructive cleanup. The affected inventory SHALL be rechecked transactionally; deleting a container to cascade through user notes is forbidden.

#### Scenario: User note is placed under module code or a host
- **WHEN** migration finds an unexpected user descendant, shared clone, user-edited asset or external reference to a cleanup candidate
- **THEN** it reports the exact conflict and leaves the graph unchanged for reviewed manual resolution, without moving, hiding or deleting the user note

#### Scenario: Clean generated assets are approved
- **WHEN** the operator approves a valid conflict-free plan and apply succeeds
- **THEN** only its verified generated code, obsolete config/host notes and owned registrations are retired, no module entry remains active, and the feature adds no visible clutter beyond the adopted capture folder

### Requirement: Atomic Recovery and Repeatable Migration
An approved migration SHALL commit adoption, hidden state, bounded cleanup and completion receipt as one recoverable transaction. Failure before commit SHALL leave the pre-migration graph intact; rerunning a completed migration SHALL perform no duplicate creation or cleanup. A receipt SHALL distinguish completed, blocked and failed attempts without exposing captured content. Fresh, one-module and supported retained-only states SHALL have explicit paths.

#### Scenario: Failure during cleanup
- **WHEN** an injected failure occurs after configuration adoption or between planned cleanup operations before commit
- **THEN** configuration, folders, registrations and notes roll back together, no completion receipt claims success, and the unchanged installation can be previewed again

#### Scenario: Resume or repeat after restart
- **WHEN** the instance restarts after successful commit or the operator reruns apply
- **THEN** the receipt and current graph confirm completion, no captured note is copied and no second folder or hidden configuration identity appears

### Requirement: Rehearsal and Rollback Evidence Before Production
Release acceptance SHALL include isolated migration rehearsals and verified native backup/restore for the new build. Before a production apply, the operator SHALL record the exact build, approved inventory, backup and rollback boundary; VC SHALL approve that apply separately. Reverting only the executable SHALL NOT be described as undoing cleaned-up module notes or newly captured data.

#### Scenario: Roll back a completed migration
- **WHEN** a production migration must be rolled back after captures or edits occur on the new build
- **THEN** operators first preserve those newer changes, then use the rehearsed database/build restore procedure or a reviewed forward fix, never an unreviewed old backup overwrite or automatic legacy reinstall
