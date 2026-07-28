---
type: Attested Computation
title: "Tokenized Collateral Eligibility Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the collateral_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/505-tokenized-collateral-eligibility-checker.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/505-tokenized-collateral-eligibility-checker.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Tokenized Collateral Eligibility Checker — attested computation

> §10.2 Attested Computation binding for [Tokenized Collateral Eligibility Checker](../tools/505-tokenized-collateral-eligibility-checker.md).

## Executor

Kernel source: `chaingraph/kernels/505-tokenized-collateral-eligibility-checker.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:37bbe20bf9c7e913038c93cc07f1425e4956c47da12a2663b58e35f50c3173c2` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
