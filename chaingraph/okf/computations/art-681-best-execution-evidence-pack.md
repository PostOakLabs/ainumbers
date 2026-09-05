---
type: Attested Computation
title: "Best-Execution Evidence Pack — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-681-best-execution-evidence-pack.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-681-best-execution-evidence-pack.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Best-Execution Evidence Pack — attested computation

> §10.2 Attested Computation binding for [Best-Execution Evidence Pack](../tools/art-681-best-execution-evidence-pack.md).

## Executor

Kernel source: `chaingraph/kernels/art-681-best-execution-evidence-pack.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:fdd1917a5a6fa8051b0636a4e2a78af93da66b2cea56d8f699fd0cf8f63a0d20` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
