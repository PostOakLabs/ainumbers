---
type: Attested Computation
title: "DORA Major-Incident Reporting Threshold Classifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the infrastructure_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-09-dora-incident-classifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-09-dora-incident-classifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# DORA Major-Incident Reporting Threshold Classifier — attested computation

> §10.2 Attested Computation binding for [DORA Major-Incident Reporting Threshold Classifier](../tools/art-09-dora-incident-classifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-09-dora-incident-classifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:34a97e2f8bf698256758e5a961ca48865bc61479195b7fe14a950d2761f10bfc` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
