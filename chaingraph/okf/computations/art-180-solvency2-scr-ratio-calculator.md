---
type: Attested Computation
title: "Solvency II SCR Ratio Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-180-solvency2-scr-ratio-calculator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-180-solvency2-scr-ratio-calculator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Solvency II SCR Ratio Calculator — attested computation

> §10.2 Attested Computation binding for [Solvency II SCR Ratio Calculator](../tools/art-180-solvency2-scr-ratio-calculator.md).

## Executor

Kernel source: `chaingraph/kernels/art-180-solvency2-scr-ratio-calculator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:9d4a1025e0982e476cc0158b3b0d24b87328adae662f2f1449a49c356fc4ee1a` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
