---
type: Attested Computation
title: "Algo Execution Schedule Simulator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-669-algo-execution-schedule-simulator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-669-algo-execution-schedule-simulator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Algo Execution Schedule Simulator — attested computation

> §10.2 Attested Computation binding for [Algo Execution Schedule Simulator](../tools/art-669-algo-execution-schedule-simulator.md).

## Executor

Kernel source: `chaingraph/kernels/art-669-algo-execution-schedule-simulator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:4bdbc0208024145fd6927060a0ca39b66c00ff5b437427fa38ae6d928628bbed` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
