---
type: Attested Computation
title: "NAIC Producer License Reciprocity Check — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-267-check-producer-license-reciprocity.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-267-check-producer-license-reciprocity.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# NAIC Producer License Reciprocity Check — attested computation

> §10.2 Attested Computation binding for [NAIC Producer License Reciprocity Check](../tools/art-267-check-producer-license-reciprocity.md).

## Executor

Kernel source: `chaingraph/kernels/art-267-check-producer-license-reciprocity.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:0120faf130b1725fa559dce448a0de45da7826fbc88e6b8377b94f361601beea` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
