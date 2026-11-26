---
type: Attested Computation
title: "Money Primitives Demonstrator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-772-money-primitives-demonstrator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-772-money-primitives-demonstrator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Money Primitives Demonstrator — attested computation

> §10.2 Attested Computation binding for [Money Primitives Demonstrator](../tools/art-772-money-primitives-demonstrator.md).

## Executor

Kernel source: `chaingraph/kernels/art-772-money-primitives-demonstrator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:f62737dbdb17a19dd9e2a94982362402465ce65482936b1e6ca3e4a9b3020f74` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
