---
type: Attested Computation
title: "ETF PCF Create/Redeem Basket Verification — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-578-etf-pcf-basket-verification.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-578-etf-pcf-basket-verification.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ETF PCF Create/Redeem Basket Verification — attested computation

> §10.2 Attested Computation binding for [ETF PCF Create/Redeem Basket Verification](../tools/art-578-etf-pcf-basket-verification.md).

## Executor

Kernel source: `chaingraph/kernels/art-578-etf-pcf-basket-verification.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:8490d544bbc1bcf3f211e1b3e65eb5f0d9d5e83522bb6baba6486139e802d40d` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
