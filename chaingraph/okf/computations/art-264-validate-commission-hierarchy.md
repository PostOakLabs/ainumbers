---
type: Attested Computation
title: "Commission Hierarchy Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-264-validate-commission-hierarchy.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-264-validate-commission-hierarchy.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Commission Hierarchy Validator — attested computation

> §10.2 Attested Computation binding for [Commission Hierarchy Validator](../tools/art-264-validate-commission-hierarchy.md).

## Executor

Kernel source: `chaingraph/kernels/art-264-validate-commission-hierarchy.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:ad511a9f6b10970b9bdc169af8f6c79d2affad7b21087262e6a7f9cf3041760c` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
