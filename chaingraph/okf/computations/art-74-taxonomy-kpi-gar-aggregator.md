---
type: Attested Computation
title: "Taxonomy KPI & Green Asset Ratio Aggregator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the model_governance decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-74-taxonomy-kpi-gar-aggregator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-74-taxonomy-kpi-gar-aggregator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Taxonomy KPI & Green Asset Ratio Aggregator — attested computation

> §10.2 Attested Computation binding for [Taxonomy KPI & Green Asset Ratio Aggregator](../tools/art-74-taxonomy-kpi-gar-aggregator.md).

## Executor

Kernel source: `chaingraph/kernels/art-74-taxonomy-kpi-gar-aggregator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:5810a300b83afde6fbf0bba7ce4da33b6fce0152cfdd4ccf02eb94258ea957d3` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
