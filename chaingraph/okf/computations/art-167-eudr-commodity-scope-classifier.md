---
type: Attested Computation
title: "EUDR Commodity Scope Classifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-167-eudr-commodity-scope-classifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-167-eudr-commodity-scope-classifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# EUDR Commodity Scope Classifier — attested computation

> §10.2 Attested Computation binding for [EUDR Commodity Scope Classifier](../tools/art-167-eudr-commodity-scope-classifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-167-eudr-commodity-scope-classifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:40d480ee243c1129a894f873de670a195ee2a65e7057d3c68c734f66227fb2da` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
