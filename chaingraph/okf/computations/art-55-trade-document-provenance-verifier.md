---
type: Attested Computation
title: "Trade Document Provenance & Consistency Verifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the cryptographic_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-55-trade-document-provenance-verifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-55-trade-document-provenance-verifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Trade Document Provenance & Consistency Verifier — attested computation

> §10.2 Attested Computation binding for [Trade Document Provenance & Consistency Verifier](../tools/art-55-trade-document-provenance-verifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-55-trade-document-provenance-verifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:1328cfacdcf71d0f8ba4acb5a20ac1da41eccca4e7b940bea943d4de82db2193` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
