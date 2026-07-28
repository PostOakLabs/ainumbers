---
type: Attested Computation
title: "CBAM Precursor-Emissions Aggregator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-72-cbam-precursor-emissions-aggregator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-72-cbam-precursor-emissions-aggregator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# CBAM Precursor-Emissions Aggregator — attested computation

> §10.2 Attested Computation binding for [CBAM Precursor-Emissions Aggregator](../tools/art-72-cbam-precursor-emissions-aggregator.md).

## Executor

Kernel source: `chaingraph/kernels/art-72-cbam-precursor-emissions-aggregator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:989771281b7268f99e74d59f151efd4deaf418e9c6e233529b873618190229fd` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
