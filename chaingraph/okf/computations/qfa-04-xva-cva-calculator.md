---
type: Attested Computation
title: "XVA / CVA Calculator — attested computation"
runtime: browser
computation: "Kernel-backed evaluation for the risk_parameter decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/qfa-04-xva-cva-calculator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/qfa-04-xva-cva-calculator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# XVA / CVA Calculator — attested computation

> §10.2 Attested Computation binding for [XVA / CVA Calculator](../tools/qfa-04-xva-cva-calculator.md).

## Executor

Kernel source: `chaingraph/kernels/qfa-04-xva-cva-calculator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:610e4753f0cc5efc58fe433b1ebc1277facbc7952b89439515a00493070bb3e0` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
