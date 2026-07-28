---
type: Attested Computation
title: "Compute Fund Expense Ratios — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the attestation_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-375-compute-fund-expense-ratios.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-375-compute-fund-expense-ratios.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Compute Fund Expense Ratios — attested computation

> §10.2 Attested Computation binding for [Compute Fund Expense Ratios](../tools/art-375-compute-fund-expense-ratios.md).

## Executor

Kernel source: `chaingraph/kernels/art-375-compute-fund-expense-ratios.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:21e7330a4b9eb3f27ddcd9bbe5fb4dcf6e3143f9aa9c05faea150bb6c5a2c1c1` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
