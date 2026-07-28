---
type: Attested Computation
title: "APP Fraud Graph Simulator — attested computation"
runtime: browser
computation: "Kernel-backed evaluation for the aml_rule decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/mms-03-app-fraud-graph.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/mms-03-app-fraud-graph.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# APP Fraud Graph Simulator — attested computation

> §10.2 Attested Computation binding for [APP Fraud Graph Simulator](../tools/mms-03-app-fraud-graph.md).

## Executor

Kernel source: `chaingraph/kernels/mms-03-app-fraud-graph.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:e4475d26f24233cd44e35864937108b85615179add6786403c54a4540d903def` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
