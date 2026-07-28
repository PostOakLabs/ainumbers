---
type: Attested Computation
title: "SII-IFRS 17 Reconciliation Bridger — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-181-sii-ifrs17-reconciliation-bridger.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-181-sii-ifrs17-reconciliation-bridger.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# SII-IFRS 17 Reconciliation Bridger — attested computation

> §10.2 Attested Computation binding for [SII-IFRS 17 Reconciliation Bridger](../tools/art-181-sii-ifrs17-reconciliation-bridger.md).

## Executor

Kernel source: `chaingraph/kernels/art-181-sii-ifrs17-reconciliation-bridger.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:83afe488b0820b034337102a6031f5e0e2ead582faf4d3998b0d65dabc2def33` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
