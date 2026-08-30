---
type: Attested Computation
title: "Ownership 50%-Rule Aggregator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-91-ownership-50pct-aggregator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-91-ownership-50pct-aggregator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Ownership 50%-Rule Aggregator — attested computation

> §10.2 Attested Computation binding for [Ownership 50%-Rule Aggregator](../tools/art-91-ownership-50pct-aggregator.md).

## Executor

Kernel source: `chaingraph/kernels/art-91-ownership-50pct-aggregator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:b11141989c4ba450fb1156c03f7307a5eb328631dfbada5c4e0d45cca04237b6` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
