---
type: Attested Computation
title: "Workpaper Bundle Composer — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the attestation_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-465-workpaper-bundle-composer.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-465-workpaper-bundle-composer.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Workpaper Bundle Composer — attested computation

> §10.2 Attested Computation binding for [Workpaper Bundle Composer](../tools/art-465-workpaper-bundle-composer.md).

## Executor

Kernel source: `chaingraph/kernels/art-465-workpaper-bundle-composer.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:60abc4f1aab3d73fb82fee1c60cd97697dfbb0b5df878b0afb3b1e879cc682ce` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
