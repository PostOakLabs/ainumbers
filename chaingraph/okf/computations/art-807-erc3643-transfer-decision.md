---
type: Attested Computation
title: "ERC-3643 Transfer Decision Recompute — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-807-erc3643-transfer-decision.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-807-erc3643-transfer-decision.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ERC-3643 Transfer Decision Recompute — attested computation

> §10.2 Attested Computation binding for [ERC-3643 Transfer Decision Recompute](../tools/art-807-erc3643-transfer-decision.md).

## Executor

Kernel source: `chaingraph/kernels/art-807-erc3643-transfer-decision.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:a13bb6fb2360995f8dd6eb7293320ae993dba46132cca39716e58ea13c783ed1` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
