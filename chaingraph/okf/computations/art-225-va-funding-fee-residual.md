---
type: Attested Computation
title: "VA Funding Fee and Residual Income — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-225-va-funding-fee-residual.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-225-va-funding-fee-residual.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# VA Funding Fee and Residual Income — attested computation

> §10.2 Attested Computation binding for [VA Funding Fee and Residual Income](../tools/art-225-va-funding-fee-residual.md).

## Executor

Kernel source: `chaingraph/kernels/art-225-va-funding-fee-residual.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:0a2c6c768159e004a4be516f27462520d1e1459d4323169d1530a336a0172053` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
