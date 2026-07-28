---
type: Attested Computation
title: "Document Integrity & eIDAS Electronic Timestamp Anchor — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-121-document-integrity-anchor.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-121-document-integrity-anchor.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Document Integrity & eIDAS Electronic Timestamp Anchor — attested computation

> §10.2 Attested Computation binding for [Document Integrity & eIDAS Electronic Timestamp Anchor](../tools/art-121-document-integrity-anchor.md).

## Executor

Kernel source: `chaingraph/kernels/art-121-document-integrity-anchor.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:7f6d0e49c1eeb8c26e4d0453f504f575f36b4547315236e2d5796bea05076cb0` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
