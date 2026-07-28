---
type: Attested Computation
title: "DORA ICT Cascade Simulator — attested computation"
runtime: browser
computation: "Kernel-backed evaluation for the infrastructure_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/pnr-01-dora-ict-cascade-simulator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/pnr-01-dora-ict-cascade-simulator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# DORA ICT Cascade Simulator — attested computation

> §10.2 Attested Computation binding for [DORA ICT Cascade Simulator](../tools/pnr-01-dora-ict-cascade-simulator.md).

## Executor

Kernel source: `chaingraph/kernels/pnr-01-dora-ict-cascade-simulator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:d4edfa0ba9cd195aecdc9a77ffd6e108ca1c8d56ad899e79cfe848617854b65c` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
