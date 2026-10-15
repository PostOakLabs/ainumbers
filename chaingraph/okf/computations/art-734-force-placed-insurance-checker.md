---
type: Attested Computation
title: "Force-Placed Insurance Notice Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the consumer_finance decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-734-force-placed-insurance-checker.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-734-force-placed-insurance-checker.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Force-Placed Insurance Notice Checker — attested computation

> §10.2 Attested Computation binding for [Force-Placed Insurance Notice Checker](../tools/art-734-force-placed-insurance-checker.md).

## Executor

Kernel source: `chaingraph/kernels/art-734-force-placed-insurance-checker.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:7577f417eecdbf8bca1781682330a4f8fd645c4692ddd0cbfbdf3974c3db9146` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
