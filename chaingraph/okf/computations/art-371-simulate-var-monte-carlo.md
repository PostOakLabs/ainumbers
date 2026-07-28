---
type: Attested Computation
title: "Portfolio VaR — Monte Carlo (Integer PRNG) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the risk_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-371-simulate-var-monte-carlo.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-371-simulate-var-monte-carlo.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Portfolio VaR — Monte Carlo (Integer PRNG) — attested computation

> §10.2 Attested Computation binding for [Portfolio VaR — Monte Carlo (Integer PRNG)](../tools/art-371-simulate-var-monte-carlo.md).

## Executor

Kernel source: `chaingraph/kernels/art-371-simulate-var-monte-carlo.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:e43e90202b192f7f8a4b0d8f5da090c81db5ea4e4d492e6c8a398ce189ac8736` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
