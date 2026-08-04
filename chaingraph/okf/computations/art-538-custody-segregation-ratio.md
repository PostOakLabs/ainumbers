---
type: Attested Computation
title: "Custody Segregation Ratio — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-538-custody-segregation-ratio.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-538-custody-segregation-ratio.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Custody Segregation Ratio — attested computation

> §10.2 Attested Computation binding for [Custody Segregation Ratio](../tools/art-538-custody-segregation-ratio.md).

## Executor

Kernel source: `chaingraph/kernels/art-538-custody-segregation-ratio.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:8791e2f24a2de92cbb8f32606cebc9fae0e42650fa20eecd57129ecd6c2fd8a8` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
