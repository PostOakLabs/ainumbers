---
type: Attested Computation
title: "SB 53 Frontier Scope Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-316-sb53-frontier-scope-checker.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-316-sb53-frontier-scope-checker.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# SB 53 Frontier Scope Checker — attested computation

> §10.2 Attested Computation binding for [SB 53 Frontier Scope Checker](../tools/art-316-sb53-frontier-scope-checker.md).

## Executor

Kernel source: `chaingraph/kernels/art-316-sb53-frontier-scope-checker.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:bf76db6dbd58cc21042569b32a4e5b60d9f4e3b31a1cded90fb40558f07ff584` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
