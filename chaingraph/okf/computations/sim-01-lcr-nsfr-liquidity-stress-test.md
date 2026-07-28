---
type: Attested Computation
title: "Liquidity Stress Test Simulator (LCR/NSFR) — attested computation"
runtime: browser
computation: "Kernel-backed evaluation for the liquidity_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/sim-01-lcr-nsfr-liquidity-stress-test.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/sim-01-lcr-nsfr-liquidity-stress-test.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Liquidity Stress Test Simulator (LCR/NSFR) — attested computation

> §10.2 Attested Computation binding for [Liquidity Stress Test Simulator (LCR/NSFR)](../tools/sim-01-lcr-nsfr-liquidity-stress-test.md).

## Executor

Kernel source: `chaingraph/kernels/sim-01-lcr-nsfr-liquidity-stress-test.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:e22635c466fd20d5fb8ff61aa494e70f70f958e303b5d52a90e0f0f22a6e930e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
