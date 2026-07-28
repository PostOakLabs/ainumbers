---
type: Attested Computation
title: "ASC 340-40 Commission Amortization — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-265-amortize-asc606-commissions.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-265-amortize-asc606-commissions.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ASC 340-40 Commission Amortization — attested computation

> §10.2 Attested Computation binding for [ASC 340-40 Commission Amortization](../tools/art-265-amortize-asc606-commissions.md).

## Executor

Kernel source: `chaingraph/kernels/art-265-amortize-asc606-commissions.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:e2860ee1786ecfb80cab10fca8acd74b179d8d80a1063d4ffa45ea30045cdbe5` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
