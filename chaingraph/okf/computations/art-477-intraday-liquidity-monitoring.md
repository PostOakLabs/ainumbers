---
type: Attested Computation
title: "BCBS 248 Intraday Liquidity Monitoring Snapshot — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-477-intraday-liquidity-monitoring.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-477-intraday-liquidity-monitoring.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# BCBS 248 Intraday Liquidity Monitoring Snapshot — attested computation

> §10.2 Attested Computation binding for [BCBS 248 Intraday Liquidity Monitoring Snapshot](../tools/art-477-intraday-liquidity-monitoring.md).

## Executor

Kernel source: `chaingraph/kernels/art-477-intraday-liquidity-monitoring.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:647771786d54eec94e4c54281af4b03bd11032678c1c363c7cbc39b9cc0a8b73` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
