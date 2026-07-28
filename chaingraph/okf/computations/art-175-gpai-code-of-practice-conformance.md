---
type: Attested Computation
title: "GPAI Code of Practice Conformance — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-175-gpai-code-of-practice-conformance.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-175-gpai-code-of-practice-conformance.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# GPAI Code of Practice Conformance — attested computation

> §10.2 Attested Computation binding for [GPAI Code of Practice Conformance](../tools/art-175-gpai-code-of-practice-conformance.md).

## Executor

Kernel source: `chaingraph/kernels/art-175-gpai-code-of-practice-conformance.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:2d637077ba70bc4b83f6fac794cc8969d09aefb67b7e5db694afbe5d9ffe8907` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
