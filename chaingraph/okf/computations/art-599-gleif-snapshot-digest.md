---
type: Attested Computation
title: "GLEIF Snapshot Digest — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the cryptographic_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-599-gleif-snapshot-digest.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-599-gleif-snapshot-digest.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# GLEIF Snapshot Digest — attested computation

> §10.2 Attested Computation binding for [GLEIF Snapshot Digest](../tools/art-599-gleif-snapshot-digest.md).

## Executor

Kernel source: `chaingraph/kernels/art-599-gleif-snapshot-digest.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:0b3902db12128174f906bfc436ef14f2415464d9bd58aa2215b3e5e2d1be2a7b` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
