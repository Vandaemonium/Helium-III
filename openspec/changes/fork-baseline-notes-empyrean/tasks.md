## 1. Repository & OpenSpec Setup (Kepler)
- [x] 1.1 Fork `TriliumNext/Trilium` to `Vandaemonium/Trilium` and clone to `/home/vc/kepler/repos/Trilium`.
- [x] 1.2 Add `openspec/` structure on a feature branch and open a PR in `Vandaemonium/Trilium`.

## 2. Sol Baseline Inspection & Fork Deployment (Houston)
- [ ] 2.1 Inspect Sol's current `trilium` service in `~/docker/compose.yaml`, `~/docker/Caddyfile`, and `~/docker/config/trilium` (read-only check of running image tag, UID/GID, and existing `notes.empyrean.cc` routing if any).
- [ ] 2.2 Provision `~/docker/config/trilium-notes` (either clean initialization or snapshot copy from `~/docker/config/trilium` per VC's choice) and configure WAL-safe backup before updates.
- [ ] 2.3 Add `trilium-notes` service to `~/docker/compose.yaml` built/pulled from `Vandaemonium/Trilium` (pinned to baseline commit `55c8d2f` / `v0.107.0` initially) and route `notes.empyrean.cc` to it in Caddy while keeping `trilium.empyrean.cc` on stock `trilium`.
- [ ] 2.4 Verify `https://notes.empyrean.cc` and `https://trilium.empyrean.cc` both return HTTP 200 and log the change in `Mac_Build_Plan.md`.
