## ADDED Requirements

### Requirement: Independently Installable Package and Retained Notes
The module SHALL declare identity, version, tested compatibility, entry points, owned code and retained data/configuration, and support inert install, activation, disable, code-only uninstall and reinstall. Captured notes SHALL remain native notes outside the code subtree. Home SHALL NOT be a required dependency.

#### Scenario: Removing code without removing the user's work
- **WHEN** the user explicitly approves a reviewed code-only uninstall after disabling the module
- **THEN** only enumerated module-owned code and registrations are removed, captured notes and pin/archive metadata remain readable in native Helium-III, retained configuration survives, and reinstall reconnects without duplicate notes or registrations

### Requirement: Guarded Code Removal
Uninstall SHALL preview exact removals, require explicit approval for deletion, and refuse cascading removal of unexpected descendants or shared assets.

#### Scenario: User content appears inside the code subtree
- **WHEN** uninstall encounters a non-owned descendant, a shared asset, or an unexpected reference
- **THEN** it refuses destructive removal and reports the conflict without changing user data

### Requirement: Reliable Text Capture
The module SHALL provide a text composer with explicit Save, visible pending/success/failure state, and a dedicated retained Quick Notes destination. It SHALL reject empty drafts, derive a title from the first nonblank line, preserve text safely in the native note body, and clear the composer only after a confirmed save. Repeated clicks during a pending save SHALL NOT issue duplicate creations. An ambiguous network failure SHALL NOT silently retry creation or claim success.

#### Scenario: Capturing a new note
- **WHEN** the user enters nonblank text and selects Save while online
- **THEN** one native text note is persisted in Quick Notes, appears as a card, remains readable after reload, and the confirmed success clears the composer

#### Scenario: Failed or uncertain save
- **WHEN** saving fails or the connection drops before persistence can be confirmed
- **THEN** draft text remains in the current composer, the UI shows failure or uncertainty rather than saved status, and no automatic retry creates a second note

#### Scenario: Captured text contains markup
- **WHEN** captured text contains HTML or script-like characters
- **THEN** it is stored and previewed as escaped text rather than executed as active content

### Requirement: Responsive Cards and Native Editing
The module SHALL display title and text previews as responsive cards on online desktop and phone browsers, support keyboard access and touch controls, and open an existing note in the native editor. Previews SHALL NOT execute active content or overwrite native rich-text bodies. Unsaved composer text SHALL NOT be silently discarded by module navigation.

#### Scenario: Using the board on desktop and phone
- **WHEN** the user views the board at desktop size or a 375 CSS-pixel-wide phone viewport
- **THEN** capture, search, pin and archive controls are usable without horizontal page scrolling, cards open their native notes, and keyboard focus is visible on desktop

#### Scenario: Native editing preserves content
- **WHEN** a captured note is edited in the native editor and the board is refreshed
- **THEN** its card reflects the saved content without flattening or replacing the native note body

### Requirement: Reversible Pin and Archive
Pin/unpin and archive/unarchive SHALL use retained module-scoped metadata. Active cards SHALL display pinned notes first and then most recently modified within each group. Archived cards SHALL be available in a separate view. These operations SHALL NOT delete notes, move unrelated notes, alter global Inbox/archive/pin conventions, or change publishing/protection settings.

#### Scenario: Pinning a note
- **WHEN** the user pins an active Quick Note and reloads
- **THEN** it remains pinned and appears before unpinned active notes, and unpinning restores ordinary ordering

#### Scenario: Archiving and restoring a note
- **WHEN** the user archives an active Quick Note and later restores it from Archived
- **THEN** it disappears only from Active, stays readable in Archived and native navigation, and returns to Active with its identity and content unchanged

### Requirement: Scoped Search and Access Boundaries
Search SHALL match Quick Notes titles and text bodies in the selected Active or Archived view, exclude unrelated notes, and provide a clear empty state. The module SHALL use authenticated frontend authority, respect protected-note access, avoid exposing locked content in previews/search, and require no embedded tokens, backend-scripting enablement or external service.

#### Scenario: Finding text within a Quick Note
- **WHEN** the user searches for text appearing only in the body of a Quick Note in the selected view
- **THEN** that note is returned and unrelated or out-of-view notes are not returned

#### Scenario: Protected content is unavailable
- **WHEN** a protected note is locked or its protected session ends
- **THEN** its protected title/body do not remain exposed in module previews or search results, and the module does not bypass native access controls
