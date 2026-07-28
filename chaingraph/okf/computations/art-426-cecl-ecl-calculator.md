---
type: Attested Computation
title: "CECL Expected Credit Loss & Allowance Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the credit_assessment decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-426-cecl-ecl-calculator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-426-cecl-ecl-calculator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# CECL Expected Credit Loss & Allowance Calculator — attested computation

> §10.2 Attested Computation binding for [CECL Expected Credit Loss & Allowance Calculator](../tools/art-426-cecl-ecl-calculator.md).

## Executor

Kernel source: `chaingraph/kernels/art-426-cecl-ecl-calculator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:3a945610238be19cfb66bb261bdb544507d2eb0d978c45a98d4f4570da40e6f8` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
