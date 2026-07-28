---
type: Attested Computation
title: "AB 2013 Training Data Disclosure Linter — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-315-ab2013-training-data-disclosure-linter.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-315-ab2013-training-data-disclosure-linter.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# AB 2013 Training Data Disclosure Linter — attested computation

> §10.2 Attested Computation binding for [AB 2013 Training Data Disclosure Linter](../tools/art-315-ab2013-training-data-disclosure-linter.md).

## Executor

Kernel source: `chaingraph/kernels/art-315-ab2013-training-data-disclosure-linter.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:669f7fe95b37812eccdd1636cf1b71298e1b1e396e96e5b505afa035a479631e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
