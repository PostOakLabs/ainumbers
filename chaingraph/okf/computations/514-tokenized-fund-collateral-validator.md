---
type: Attested Computation
title: "Tokenized Fund Collateral Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the collateral_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/514-tokenized-fund-collateral-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/514-tokenized-fund-collateral-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Tokenized Fund Collateral Validator — attested computation

> §10.2 Attested Computation binding for [Tokenized Fund Collateral Validator](../tools/514-tokenized-fund-collateral-validator.md).

## Executor

Kernel source: `chaingraph/kernels/514-tokenized-fund-collateral-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:50741b9d96f28fae793b5612ef94aa0a7d4d82c7caee633d71ef57ed9a5430fe` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
