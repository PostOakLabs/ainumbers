---
type: Attested Computation
title: "15c3-3a Note H Margin-Debit Computation — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-580-15c3-3a-note-h-margin-debit.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-580-15c3-3a-note-h-margin-debit.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# 15c3-3a Note H Margin-Debit Computation — attested computation

> §10.2 Attested Computation binding for [15c3-3a Note H Margin-Debit Computation](../tools/art-580-15c3-3a-note-h-margin-debit.md).

## Executor

Kernel source: `chaingraph/kernels/art-580-15c3-3a-note-h-margin-debit.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:3bdfd9647ff94c830fe925048617e9528272a1bd33da7bc0a2a640e70563eea2` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
