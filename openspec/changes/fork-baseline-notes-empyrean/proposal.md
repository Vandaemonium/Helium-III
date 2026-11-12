# Helium-III Fork Baseline & Patch Pipeline at notes.empyrean.cc

## Why
VC decided to fork `TriliumNext/Trilium` immediately and name the fork **Helium-III** (`Vandaemonium/Helium-III`, cloned locally as `Helium-III`), host the fork at `notes.empyrean.cc` starting with a fresh empty database while leaving `trilium.empyrean.cc` as stock Trilium, and bring `notes.empyrean.cc` to a patch-ready state immediately so VC can use it daily while incremental updates and modules are developed.

## What Changes
- Establish **Helium-III** (`Vandaemonium/Helium-III`, forked from `TriliumNext/Trilium` v0.107.0) as the canonical source repository for `notes.empyrean.cc`, with `openspec/` tracked in-repo.
- Define the Sol deployment topology (executed by Houston): a dedicated container (`trilium-notes`) and freshly initialized isolated data directory (`~/docker/config/trilium-notes`) served behind Caddy at `https://notes.empyrean.cc`, keeping `trilium` (`https://trilium.empyrean.cc`) untouched on the stock upstream image.
- Define the patch-acceptance and rollback contract: branch + PR review in **Helium-III**, pre-patch SQLite WAL-safe backup verification, container/module update on `notes.empyrean.cc`, and instant rollback without affecting stock `trilium.empyrean.cc`.

## Impact
- Affected specs: `fork-baseline-patch-pipeline`
- Affected systems: **Helium-III** GitHub repository (`Vandaemonium/Helium-III`); Sol `~/docker/compose.yaml` and Caddyfile (via Houston). Stock `trilium.empyrean.cc` and `nootion.empyrean.cc` remain untouched.
