---
type: Attested Computation
title: "SCO60 Crypto-Asset Exposure Classifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-281-sco60-crypto-asset-exposure-classifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-281-sco60-crypto-asset-exposure-classifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# SCO60 Crypto-Asset Exposure Classifier — attested computation

> §10.2 Attested Computation binding for [SCO60 Crypto-Asset Exposure Classifier](../tools/art-281-sco60-crypto-asset-exposure-classifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-281-sco60-crypto-asset-exposure-classifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:27ca4b94e8f9b63be974894cab2c35fdb00b72b8c405455fead9dc3a6de0cdd9` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
