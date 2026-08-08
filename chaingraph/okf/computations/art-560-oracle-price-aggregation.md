---
type: Attested Computation
title: "Oracle Price Aggregation — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the oracle_price_aggregation decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-560-oracle-price-aggregation.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-560-oracle-price-aggregation.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Oracle Price Aggregation — attested computation

> §10.2 Attested Computation binding for [Oracle Price Aggregation](../tools/art-560-oracle-price-aggregation.md).

## Executor

Kernel source: `chaingraph/kernels/art-560-oracle-price-aggregation.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:ba126694afd24428319b321cbc06447608573deb30aaa75f5905a25146b3b91f` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
