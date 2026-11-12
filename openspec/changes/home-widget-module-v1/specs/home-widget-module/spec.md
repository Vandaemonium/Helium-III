## ADDED Requirements

### Requirement: Versioned Note-Subtree Module Package Contract
A note-subtree feature module SHALL declare a machine-readable manifest (`moduleId`, `version`, `compatibleTriliumRange`, `entryPoints`, `ownedCodePaths`, `retainedDataPaths`) and keep all executable code notes separate from user data and configuration notes.

#### Scenario: Importing and activating the Home module
- **WHEN** the `home-panel` module package is imported into Trilium with safe import enabled
- **THEN** its executable code notes remain inert until explicitly activated, and activation registers only the declared Home Render Note / widget entry point without modifying unrelated notes

### Requirement: Personal Home Panel Views
The `home-panel` module SHALL render a read-only overview of Recent Notes, Pinned Notes, and Inbox items using the logged-in frontend API, and SHALL function both as a standalone Home Render Note and as a child widget inside a native Trilium Dashboard collection.

#### Scenario: Viewing Home panel sections
- **WHEN** the user opens the Home note or Dashboard containing `home-panel`
- **THEN** the module displays links to recently modified notes, notes tagged `#pinned` (or configured pin target), and notes under the configured Inbox root

### Requirement: Code-Only Uninstall Preserving User Data
Uninstalling the `home-panel` module SHALL remove only the module's owned executable code notes and active registrations while preserving all user notes, pinned tags, inbox notes, and user module configuration.

#### Scenario: Uninstalling and reinstalling the module
- **WHEN** the user disables and uninstalls `home-panel`
- **THEN** the module's code bundle is removed, user notes and configuration remain intact and readable in native Trilium, and reinstalling `home-panel` reconnects to the retained configuration without duplicate handlers
