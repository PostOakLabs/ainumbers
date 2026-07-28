---
type: Attested Computation
title: "Agency Eligibility Matrix — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-222-agency-eligibility-matrix.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-222-agency-eligibility-matrix.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Agency Eligibility Matrix — attested computation

> §10.2 Attested Computation binding for [Agency Eligibility Matrix](../tools/art-222-agency-eligibility-matrix.md).

## Executor

Kernel source: `chaingraph/kernels/art-222-agency-eligibility-matrix.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:1974e5147a75759c71c8deb05d10e26b2803fb3ce6c5947cabd998c089cf0e49` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
