## Purpose

Provide a native Home overview when the user opens the actual root, without generated host notes or changes to the user's underlying note tree.

## ADDED Requirements

### Requirement: Home Is the Normal Root View
Helium-III SHALL show built-in Home for the normal view of note `root` on desktop and phone. It SHALL NOT require a Render Note, executable note, imported package or separate Home host. Existing explicit alternate views SHALL remain available.

#### Scenario: Open the actual root
- **WHEN** the user opens `root` through the tree, a native link or a restored tab in normal view
- **THEN** Recent, Pinned and Inbox appear in the root content area without redirecting to another note

#### Scenario: Preserve other notes and root data
- **WHEN** Home becomes the root view
- **THEN** root identity, title, stored content, attributes, protection and child branches are unchanged, explicit root source/alternate views remain usable, and ordinary books and Render Notes retain their native views

### Requirement: Home Preserves Overview Semantics
Home SHALL provide read-only Recent, Pinned and Inbox sections with the configured limits and selectors. Recent SHALL use modification order; Pinned SHALL use the configured global pin label; Inbox SHALL include eligible notes bearing the configured Inbox label and eligible direct children of labeled folders, deduplicated by note ID. Quick Notes pin/archive labels SHALL NOT redefine these selectors.

#### Scenario: Edited configuration is kept
- **WHEN** the user edits the hidden Home configuration's section limits and pin/Inbox labels
- **THEN** Home honors those values and restarts do not overwrite them with defaults

#### Scenario: Fresh configuration and no Inbox
- **WHEN** the Home configuration is fresh and no Inbox-labeled note exists
- **THEN** defaults are Recent 8, Pinned 12 with `pinned`, and Inbox 10 with `inbox`, with a clear Inbox empty state and no extra visible Inbox or configuration folder created

### Requirement: Home Excludes Sensitive and Administrative Notes
Home SHALL exclude all protected notes, including unlocked ones, and all hidden/system and generated module code/config/host notes from every section. It SHALL honor the configured archive-exclusion setting and exclude archived notes by default. Filtering SHALL precede section limiting so excluded candidates do not crowd out available eligible notes.

#### Scenario: Protected or hidden notes match a selector
- **WHEN** a protected, hidden or generated administrative note would otherwise qualify for Recent, Pinned or Inbox
- **THEN** no title, body, identifier, timestamp, count contribution or cached Home item from that note is exposed

#### Scenario: Many recent candidates are excluded
- **WHEN** excluded notes are more recent than eligible user notes
- **THEN** Recent returns up to its configured number of eligible notes if enough exist, rather than stopping at an arbitrary pre-filter oversampling cutoff

### Requirement: Home Refresh and Native Navigation
Home SHALL refresh from saved note and metadata changes and protected-session transitions, display distinct loading/error/empty states, and navigate links using native note contexts. It SHALL render titles as inert text and SHALL NOT rewrite note contents to produce summaries.

#### Scenario: A note changes while Home is open
- **WHEN** an eligible note is edited, pinned, archived or protected in another native context and its change reaches the client
- **THEN** the relevant sections update, protected summaries disappear immediately on the change, and late responses cannot reintroduce stale excluded data

#### Scenario: Open a Home link
- **WHEN** the user activates a Home item using keyboard or touch
- **THEN** the intended native note is opened, visible focus and back navigation work, and no script-like title is executed
