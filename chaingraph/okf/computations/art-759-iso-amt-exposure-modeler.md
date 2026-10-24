---
type: Attested Computation
title: "ISO AMT Exposure Modeler — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the consumer_finance decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-759-iso-amt-exposure-modeler.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-759-iso-amt-exposure-modeler.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ISO AMT Exposure Modeler — attested computation

> §10.2 Attested Computation binding for [ISO AMT Exposure Modeler](../tools/art-759-iso-amt-exposure-modeler.md).

## Executor

Kernel source: `chaingraph/kernels/art-759-iso-amt-exposure-modeler.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:0cfc6871b5e506aedc2ed9dd8d8b59b8f81e58e537501004068a454b020f3180` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
