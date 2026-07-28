---
type: Attested Computation
title: "Provable Reputation Score Aggregator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the attestation_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-278-reputation-score-aggregator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-278-reputation-score-aggregator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Provable Reputation Score Aggregator — attested computation

> §10.2 Attested Computation binding for [Provable Reputation Score Aggregator](../tools/art-278-reputation-score-aggregator.md).

## Executor

Kernel source: `chaingraph/kernels/art-278-reputation-score-aggregator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:7d2c98e83ecc6bbe23df123d45d26fe3f2b31d5dc6484e5983f535fdbd271c86` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
