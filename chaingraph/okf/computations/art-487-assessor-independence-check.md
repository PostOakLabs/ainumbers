---
type: Attested Computation
title: "Swift CSP Assessor Independence Eligibility — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-487-assessor-independence-check.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-487-assessor-independence-check.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Swift CSP Assessor Independence Eligibility — attested computation

> §10.2 Attested Computation binding for [Swift CSP Assessor Independence Eligibility](../tools/art-487-assessor-independence-check.md).

## Executor

Kernel source: `chaingraph/kernels/art-487-assessor-independence-check.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:296ba15821ab17012505cf41cea3e5915f9146eae5c97eab522579f9cd5fe663` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
