---
type: Attested Computation
title: "FR 2052a Inflow/Outflow Bucket Classifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the regulatory_reporting decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-437-fr2052a-inflow-outflow-classifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-437-fr2052a-inflow-outflow-classifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# FR 2052a Inflow/Outflow Bucket Classifier — attested computation

> §10.2 Attested Computation binding for [FR 2052a Inflow/Outflow Bucket Classifier](../tools/art-437-fr2052a-inflow-outflow-classifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-437-fr2052a-inflow-outflow-classifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:e6b15395a2f44a43b2968b7f10f6d7ef12137cd68b1a0ff292e5031b775f4f97` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
