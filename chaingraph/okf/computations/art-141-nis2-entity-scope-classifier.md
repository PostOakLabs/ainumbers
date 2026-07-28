---
type: Attested Computation
title: "NIS2 Entity Scope Classifier (Essential / Important / Out-of-Scope) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-141-nis2-entity-scope-classifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-141-nis2-entity-scope-classifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# NIS2 Entity Scope Classifier (Essential / Important / Out-of-Scope) — attested computation

> §10.2 Attested Computation binding for [NIS2 Entity Scope Classifier (Essential / Important / Out-of-Scope)](../tools/art-141-nis2-entity-scope-classifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-141-nis2-entity-scope-classifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:f5cdbd302bc819281ca45b0324490e3843d98a3ff0912db8177a323a66c79336` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
