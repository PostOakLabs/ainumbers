---
type: Attested Computation
title: "FSMA 204 Traceability Lot Code Chain Linker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-119-traceability-lot-code-linker.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-119-traceability-lot-code-linker.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# FSMA 204 Traceability Lot Code Chain Linker — attested computation

> §10.2 Attested Computation binding for [FSMA 204 Traceability Lot Code Chain Linker](../tools/art-119-traceability-lot-code-linker.md).

## Executor

Kernel source: `chaingraph/kernels/art-119-traceability-lot-code-linker.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:9c508df29c7b972a6c75f1ad355d117b4554a2b3faebc82012baddb301528df5` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
