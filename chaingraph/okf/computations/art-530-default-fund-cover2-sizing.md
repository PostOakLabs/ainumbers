---
type: Attested Computation
title: "CCP Default Fund Cover-2 Sizing — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the risk_parameter decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-530-default-fund-cover2-sizing.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-530-default-fund-cover2-sizing.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# CCP Default Fund Cover-2 Sizing — attested computation

> §10.2 Attested Computation binding for [CCP Default Fund Cover-2 Sizing](../tools/art-530-default-fund-cover2-sizing.md).

## Executor

Kernel source: `chaingraph/kernels/art-530-default-fund-cover2-sizing.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:4d53619712ff1da614212e1de80b28da3a815322d590e9fa5f7dd3db647c59b2` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
