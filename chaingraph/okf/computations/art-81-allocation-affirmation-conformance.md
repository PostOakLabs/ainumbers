---
type: Attested Computation
title: "Allocation/Affirmation Conformance Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-81-allocation-affirmation-conformance.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-81-allocation-affirmation-conformance.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Allocation/Affirmation Conformance Checker — attested computation

> §10.2 Attested Computation binding for [Allocation/Affirmation Conformance Checker](../tools/art-81-allocation-affirmation-conformance.md).

## Executor

Kernel source: `chaingraph/kernels/art-81-allocation-affirmation-conformance.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:bfd9eea1801c12c0b1358e111e33f08fcc221f3e847edd481053c5e90f81cd12` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
