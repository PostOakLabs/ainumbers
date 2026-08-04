---
type: Attested Computation
title: "Cross-CCP PQD Comparator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the regulatory_reporting decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-528-cross-ccp-pqd-comparator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-528-cross-ccp-pqd-comparator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Cross-CCP PQD Comparator — attested computation

> §10.2 Attested Computation binding for [Cross-CCP PQD Comparator](../tools/art-528-cross-ccp-pqd-comparator.md).

## Executor

Kernel source: `chaingraph/kernels/art-528-cross-ccp-pqd-comparator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:fd251101f928b941bade8919f9fc8215154f87e82c9ec9e6953ea483c95b82f1` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
