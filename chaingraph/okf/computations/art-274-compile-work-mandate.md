---
type: Attested Computation
title: "Work Mandate Compiler — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the governance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-274-compile-work-mandate.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-274-compile-work-mandate.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Work Mandate Compiler — attested computation

> §10.2 Attested Computation binding for [Work Mandate Compiler](../tools/art-274-compile-work-mandate.md).

## Executor

Kernel source: `chaingraph/kernels/art-274-compile-work-mandate.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:dfaeb21e94c9b39448879e93b1365cb0b50c1251a16b57a90133275b8739d6ad` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
