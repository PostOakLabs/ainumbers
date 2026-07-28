---
type: Attested Computation
title: "Debt Validation Notice Completeness Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-403-check-debt-validation-notice.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-403-check-debt-validation-notice.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Debt Validation Notice Completeness Checker — attested computation

> §10.2 Attested Computation binding for [Debt Validation Notice Completeness Checker](../tools/art-403-check-debt-validation-notice.md).

## Executor

Kernel source: `chaingraph/kernels/art-403-check-debt-validation-notice.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:7587d455f6bdc2449925d27d42cc07a2660c799f4670d238cb0793af19d274fa` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
