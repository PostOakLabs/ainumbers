---
type: Attested Computation
title: "Basel Output-Floor Phase-In Simulator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-358-simulate-output-floor.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-358-simulate-output-floor.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Basel Output-Floor Phase-In Simulator — attested computation

> §10.2 Attested Computation binding for [Basel Output-Floor Phase-In Simulator](../tools/art-358-simulate-output-floor.md).

## Executor

Kernel source: `chaingraph/kernels/art-358-simulate-output-floor.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:8f781a73d514cd1ee4db0e654c32b3a632a43e3a7fdd02cc1c2f881a6bfbd873` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
