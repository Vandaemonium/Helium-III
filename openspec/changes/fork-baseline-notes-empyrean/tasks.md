## 1. Repository & OpenSpec Setup (Kepler)
- [x] 1.1 Fork `TriliumNext/Trilium` as **Helium-III** (`Vandaemonium/Trilium`, local clone at `/home/vc/kepler/repos/Helium-III`).
- [x] 1.2 Add `openspec/` structure on a feature branch, open PR #1, and merge to `main` after VC approval.

## 2. Sol Baseline Inspection & Fork Deployment (Houston)
- [ ] 2.1 Inspect Sol's current `trilium` service in `~/docker/compose.yaml`, `~/docker/Caddyfile`, and `~/docker/config/trilium` (read-only check of running image tag, UID/GID, and existing `notes.empyrean.cc` routing if any).
- [ ] 2.2 Provision a fresh empty `~/docker/config/trilium-notes` directory (per VC's 2026-11-12 decision to start fresh) and configure WAL-safe backup before updates.
- [ ] 2.3 Add `trilium-notes` service to `~/docker/compose.yaml` backed by **Helium-III** (`~/projects/helium-iii`, pinned to baseline commit `55c8d2f` / `v0.107.0` initially) and route `notes.empyrean.cc` to it in Caddy while keeping `trilium.empyrean.cc` on stock `trilium`.
- [ ] 2.4 Verify `https://notes.empyrean.cc` and `https://trilium.empyrean.cc` both return HTTP 200 and log the change in `Mac_Build_Plan.md`.
