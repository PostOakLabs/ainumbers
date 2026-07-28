---
type: Attested Computation
title: "On-Chain Repo Haircut Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the collateral_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/508-repo-haircut-collateral-calculator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/508-repo-haircut-collateral-calculator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# On-Chain Repo Haircut Calculator — attested computation

> §10.2 Attested Computation binding for [On-Chain Repo Haircut Calculator](../tools/508-repo-haircut-collateral-calculator.md).

## Executor

Kernel source: `chaingraph/kernels/508-repo-haircut-collateral-calculator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:7acd49f6f660a85da84398f65f694822d18b97e1241d8b3fc15fc177b11285a5` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
