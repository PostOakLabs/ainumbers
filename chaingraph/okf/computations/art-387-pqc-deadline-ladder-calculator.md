---
type: Attested Computation
title: "CNSA 2.0 Deadline Ladder Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-387-pqc-deadline-ladder-calculator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-387-pqc-deadline-ladder-calculator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# CNSA 2.0 Deadline Ladder Calculator — attested computation

> §10.2 Attested Computation binding for [CNSA 2.0 Deadline Ladder Calculator](../tools/art-387-pqc-deadline-ladder-calculator.md).

## Executor

Kernel source: `chaingraph/kernels/art-387-pqc-deadline-ladder-calculator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:22f4891e4f4169482a7f9026e33d39349cbee9578f4001be24826afadcb85c1c` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
