---
type: Attested Computation
title: "EMIR 3 SIMM Approval-Scope Classifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-581-emir3-simm-approval-scope-classifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-581-emir3-simm-approval-scope-classifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# EMIR 3 SIMM Approval-Scope Classifier — attested computation

> §10.2 Attested Computation binding for [EMIR 3 SIMM Approval-Scope Classifier](../tools/art-581-emir3-simm-approval-scope-classifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-581-emir3-simm-approval-scope-classifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:05b8c0c228321335e7ba3d1133c961b3ba2aebcd9e92f1735833b892d78170ce` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
