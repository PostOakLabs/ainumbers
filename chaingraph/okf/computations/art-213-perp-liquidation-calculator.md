---
type: Attested Computation
title: "Perp Margin and Liquidation Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the derivatives_margin_health decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-213-perp-liquidation-calculator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-213-perp-liquidation-calculator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Perp Margin and Liquidation Calculator — attested computation

> §10.2 Attested Computation binding for [Perp Margin and Liquidation Calculator](../tools/art-213-perp-liquidation-calculator.md).

## Executor

Kernel source: `chaingraph/kernels/art-213-perp-liquidation-calculator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:2fccd34d45ee83dbb10844e720e1c4469b6f63bec1243d60757849f139768803` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
