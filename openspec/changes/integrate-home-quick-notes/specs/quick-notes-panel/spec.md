## Purpose

Let users capture and manage native Quick Notes alongside their work, with equivalent online desktop and phone behavior and no special host note.

## ADDED Requirements

### Requirement: Native Desktop and Phone Panel
Quick Notes SHALL be a built-in right-sidebar tab usable beside any open note on desktop, independent of its type and the AI toggle. On phones the same feature SHALL appear as a Quick Notes tab in the native note-panel modal, not a simultaneous narrow side column or a generated note. Closing that modal SHALL restore the underlying note.

#### Scenario: Capture beside an arbitrary note
- **WHEN** the user opens Quick Notes while viewing a text note, PDF, image, root or protected note
- **THEN** the feature is available, capture still targets only its configured unprotected folder, and the current note's protected content is not copied or used as capture context

#### Scenario: Open Quick Notes on a phone
- **WHEN** the user opens the native note-panel modal and selects Quick Notes at a 375 CSS-pixel viewport
- **THEN** composer, Save, cards, search and pin/archive controls are touch-usable without horizontal page scrolling, and closing the modal returns to the original note

### Requirement: Explicit Safe Text Capture
The composer SHALL reject blank input, derive the title from the first nonblank line and save escaped text as one native text note in Quick Notes only after explicit Save. It SHALL show pending/success/failure state, suppress repeated creation while pending and clear the saved draft only after persistence is confirmed. Capture SHALL NOT enable scripting or execute entered markup.

#### Scenario: Successful capture with markup
- **WHEN** the user saves nonblank text containing HTML-like characters
- **THEN** exactly one confirmed native text note is shown as a card with the first nonblank line as its title, the body/preview treats markup as text, and the saved composer text clears

#### Scenario: Failed or uncertain persistence
- **WHEN** a save fails or its response is lost after possible persistence
- **THEN** the draft stays, failure or uncertainty is visible, no automatic creation retry occurs, and an uncertain creation cannot be retried until the user explicitly acknowledges checking for an existing note

### Requirement: Drafts Survive Panel Lifecycle
Unsaved drafts and pending/uncertain-save state SHALL survive native note navigation, sidebar tab switches, peek dismissal, hard close/reopen and phone modal dismissal within the same app session. A pending save SHALL not be duplicated by remounting. Browser unload SHALL warn when draft or unresolved-save state exists; no offline queue or persistent browser draft store is required.

#### Scenario: Hard-close and reopen while saving
- **WHEN** the user saves, closes the sidebar and opens it on another note before confirmation
- **THEN** the same pending operation remains authoritative, no second creation starts, and its eventual result updates the same draft state

#### Scenario: Dismiss a phone composer
- **WHEN** a user closes the phone note-panel modal with unsaved text and later reopens it
- **THEN** the same text is available and no silent discard or automatic save occurs

### Requirement: Scoped Cards and Native Editing
Cards SHALL represent only eligible direct native text-note children of the configured Quick Notes folder, show inert title/body text previews and open notes in the current native editor context. Saved native edits SHALL update the cards without flattening rich-text bodies. Nested/unrelated or other-type notes SHALL remain intact even when omitted from cards.

#### Scenario: Native editing round trip
- **WHEN** a user opens a Quick Note card, edits it with the native rich-text editor and returns to the panel
- **THEN** the same note ID and rich-text body remain, its saved title/preview refreshes, and unrelated or nested notes are not treated as cards

### Requirement: Retained Scoped Pin Archive and Search
Pin/unpin and archive/restore SHALL retain the non-inherited `heliumQuickPinned` and `heliumQuickArchived` true/false metadata. Active and Archived SHALL be separate views, with pinned-first then modified-descending ordering and deterministic ties. Case-insensitive search SHALL match title and body text only within the selected view. These actions SHALL NOT delete notes or change global pin, Inbox or publishing conventions.

#### Scenario: Pin archive restore and search after reload
- **WHEN** the user reloads the app, pins an Active card, archives it, searches for body text in Archived and restores it
- **THEN** the same note retains its content and identity, appears only in the appropriate view, sorts correctly and returns to Active without changing global pin or Inbox labels

### Requirement: Protected Data and Stale Results Never Enter the Panel
Quick Notes SHALL exclude all protected notes, even while unlocked, from cards, search, previews and mutations. A protected, hidden, missing or invalid capture destination SHALL block Save with an actionable error, never silently create elsewhere or downgrade protection. In-flight queries and drafts SHALL remain isolated from the current note and late responses SHALL not restore excluded cards.

#### Scenario: Protection changes while results are loading
- **WHEN** a card's note becomes protected or a protected session changes before an earlier request completes
- **THEN** sensitive card state is cleared and the stale response cannot repopulate it, while the native protected-note access model is not bypassed

#### Scenario: Destination becomes protected or disappears
- **WHEN** the configured Quick Notes folder is protected, hidden, deleted or unavailable at save time
- **THEN** no note is created, the draft remains, and the user sees a destination-recovery error rather than a replacement folder being created silently
