---
type: Attested Computation
title: "Private-Input Capital Adequacy Check — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-415-check-capital-adequacy-private.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-415-check-capital-adequacy-private.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Private-Input Capital Adequacy Check — attested computation

> §10.2 Attested Computation binding for [Private-Input Capital Adequacy Check](../tools/art-415-check-capital-adequacy-private.md).

## Executor

Kernel source: `chaingraph/kernels/art-415-check-capital-adequacy-private.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:2ea7eb0372ecebf09f65212f7005ce7e5e31c1e0b784b1a8e55b057cc5f98846` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
