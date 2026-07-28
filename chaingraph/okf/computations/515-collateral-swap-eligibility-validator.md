---
type: Attested Computation
title: "Collateral Swap Eligibility Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the collateral_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/515-collateral-swap-eligibility-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/515-collateral-swap-eligibility-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Collateral Swap Eligibility Validator — attested computation

> §10.2 Attested Computation binding for [Collateral Swap Eligibility Validator](../tools/515-collateral-swap-eligibility-validator.md).

## Executor

Kernel source: `chaingraph/kernels/515-collateral-swap-eligibility-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:678f918188301de63b9847665aa262f6fc73e09a1b28292b6bd3a8b79e4a51bf` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
