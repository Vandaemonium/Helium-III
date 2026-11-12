## ADDED Requirements

### Requirement: Dual-Instance Isolation Between Fork and Stock Trilium
The deployment SHALL run the `Vandaemonium/Trilium` fork at `https://notes.empyrean.cc` using a dedicated container and data directory, while preserving `https://trilium.empyrean.cc` on the stock `TriliumNext/Trilium` image and its existing data directory.

#### Scenario: Independent operation of fork and stock instances
- **WHEN** `notes.empyrean.cc` is deployed or restarted with a patch from `Vandaemonium/Trilium`
- **THEN** `trilium.empyrean.cc` continues running stock Trilium with no shared SQLite database, port conflict, or session interruption

### Requirement: Patch-Ready Update and Rollback Pipeline
The `notes.empyrean.cc` instance SHALL accept incremental patches from reviewed branches/releases of `Vandaemonium/Trilium` and support rollback using an application-consistent SQLite backup taken prior to any update.

#### Scenario: Applying a patch to the live personal instance
- **WHEN** a reviewed change is merged in `Vandaemonium/Trilium` (or packaged as a note-subtree artifact)
- **THEN** Houston (for container/core patches) or the module installer (for note-subtree modules) records a pre-update backup of `notes.empyrean.cc`, applies the update, verifies HTTP 200 and note read/write health, and retains the previous image/artifact for rollback
