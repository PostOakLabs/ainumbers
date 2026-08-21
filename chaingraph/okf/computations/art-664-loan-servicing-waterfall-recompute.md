---
type: Attested Computation
title: "Loan Servicing Waterfall Recompute — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-664-loan-servicing-waterfall-recompute.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-664-loan-servicing-waterfall-recompute.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Loan Servicing Waterfall Recompute — attested computation

> §10.2 Attested Computation binding for [Loan Servicing Waterfall Recompute](../tools/art-664-loan-servicing-waterfall-recompute.md).

## Executor

Kernel source: `chaingraph/kernels/art-664-loan-servicing-waterfall-recompute.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:a5294931be53b050f99b64e583ecf46c561050b194b01b0a27b92cec2c735a78` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
