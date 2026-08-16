---
type: Attested Computation
title: "Rate Reconciliation 5% Threshold Classifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-635-rate-rec-5pct-threshold-classifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-635-rate-rec-5pct-threshold-classifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Rate Reconciliation 5% Threshold Classifier — attested computation

> §10.2 Attested Computation binding for [Rate Reconciliation 5% Threshold Classifier](../tools/art-635-rate-rec-5pct-threshold-classifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-635-rate-rec-5pct-threshold-classifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:d64faa0765db8024c6f6057f6f2e5ae0c86940532c5207fd7dabd0b07488b14c` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
