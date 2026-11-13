## Purpose

Keep Home and Quick Notes configuration out of the ordinary note tree while preserving captures as real, synchronizable notes in one visible destination.

## ADDED Requirements

### Requirement: Compiled App Features Without a Module Lifecycle
Home and Quick Notes SHALL be app code compiled into Helium-III, not specialized notes. Neither feature SHALL create or depend on feature-owned Render Notes, executable code notes, host notes or install/activate/uninstall commands. Their module packaging SHALL NOT remain a supported product path. Only ordinary captured content and inert hidden configuration SHALL use notes. Leftover notes from the retired modules SHALL be ignored: neither feature reads, adopts, modifies or deletes them.

#### Scenario: Use a build on a database with no modules
- **WHEN** a user opens root or the Quick Notes panel in the integrated build on a clean supported database
- **THEN** the compiled UI works without importing or activating a note package, and initialization creates only the ordinary capture folder and inert hidden state, never feature Render/code/host notes

#### Scenario: Check distribution and feature toggles
- **WHEN** the integrated release is built or either presentation is toggled
- **THEN** no Home/Quick Notes package installer, bundle builder or activation/uninstall lifecycle is shipped or invoked; toggles affect only presentation, user-owned code/Render Notes are unaffected

### Requirement: Hidden Feature Configuration
Home settings and the Quick Notes destination reference SHALL live under deterministic `_helium...` identities inside `_hidden`, without visible config/host/code notes or executable note bundles. Restart, sync and backup/restore SHALL preserve configured values instead of reseeding defaults over them. Hidden placement SHALL NOT be represented as encryption or an authorization boundary.

#### Scenario: Restart after changing settings
- **WHEN** an instance restarts or its hidden subtree is checked after the user changes supported feature settings
- **THEN** the same hidden configuration is reused, settings survive, and no visible configuration note is created

#### Scenario: Inspect ordinary navigation and feature results
- **WHEN** the user uses the ordinary note tree, Home or Quick Notes
- **THEN** feature configuration does not appear as feature clutter or ordinary result items, while existing native access to system settings remains available

### Requirement: One Visible Native Capture Folder
The integration SHALL use one configured visible unprotected folder for Quick Notes, created by setup under root with a deterministic note ID and named `Quick Notes`. A folder the user renames keeps working, since it is found by ID. An unrelated top-level folder already named `Quick Notes` SHALL NOT be adopted or combined; setup SHALL leave both alone and report the conflict instead of creating a duplicate. A legacy module folder (`Quick Notes — Notes`) is an unrelated folder.

#### Scenario: Visible folder collision
- **WHEN** setup finds an unrelated top-level `Quick Notes` folder
- **THEN** it creates no destination, leaves the existing folder untouched and the panel explains how to resolve the conflict (rename the existing folder)

### Requirement: Fresh Setup Is Idempotent
On a database that never had either module, Home SHALL be usable without installing a module and setup SHALL create one native Quick Notes folder and the hidden configuration. Repeated initialization, concurrent startup and supported peer synchronization SHALL converge without duplicate configuration or destination folders. Leftover module notes SHALL NOT change setup.

#### Scenario: Initialize twice and sync
- **WHEN** a fresh supported database is initialized repeatedly or synchronized between two initialized peers
- **THEN** there is one feature capture destination and one hidden configuration identity for each feature, with existing notes/settings retained

#### Scenario: Leftover module notes
- **WHEN** notes of the retired Home or Quick Notes modules exist in the database
- **THEN** setup and both features behave as on a fresh database and leave those notes unchanged; Home does not list them

### Requirement: Capture Data Remains Native
Captured notes, bodies, identities, attributes and branch relationships SHALL remain ordinary native data usable independently of either feature. Existing pin/archive metadata, protection, timestamps and rich-text bodies SHALL not be rewritten by initialization. Backup, restore and supported synchronization SHALL retain both the data and its configured destination.

#### Scenario: Disable the features or restore a backup
- **WHEN** the user disables the built-in presentation or restores a verified native backup to a compatible build
- **THEN** captured notes remain readable/editable in the native tree, scoped metadata and configured destination survive, and enabling the presentation reconnects without reimporting notes

### Requirement: Authenticated Cross-Runtime Access
The built-in features SHALL use native authenticated application authority and synchronization-aware changes without embedded credentials, external services or backend-scripting enablement. Shared data/setup behavior SHALL work in server, desktop and standalone runtimes. UI preference options SHALL use the application's typed option mechanism rather than arbitrary visible configuration notes.

#### Scenario: Use standalone and hosted builds
- **WHEN** Home or capture setup is used in a supported standalone, desktop or hosted build
- **THEN** the feature follows the same storage/access rules without a Node-only dependency, ETAPI token or client bypass of native authority
