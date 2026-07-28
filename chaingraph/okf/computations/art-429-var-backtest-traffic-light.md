---
type: Attested Computation
title: "VaR Backtesting Traffic-Light Zone Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the capital_assessment decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-429-var-backtest-traffic-light.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-429-var-backtest-traffic-light.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# VaR Backtesting Traffic-Light Zone Calculator — attested computation

> §10.2 Attested Computation binding for [VaR Backtesting Traffic-Light Zone Calculator](../tools/art-429-var-backtest-traffic-light.md).

## Executor

Kernel source: `chaingraph/kernels/art-429-var-backtest-traffic-light.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:25b20c0e87bf44b54d5c7f92e3ac4994db2af88a5fcb98ee3755972234fafe6b` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
