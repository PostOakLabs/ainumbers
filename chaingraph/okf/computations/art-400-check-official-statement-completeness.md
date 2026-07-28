---
type: Attested Computation
title: "Municipal Official Statement Completeness Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-400-check-official-statement-completeness.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-400-check-official-statement-completeness.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Municipal Official Statement Completeness Checker — attested computation

> §10.2 Attested Computation binding for [Municipal Official Statement Completeness Checker](../tools/art-400-check-official-statement-completeness.md).

## Executor

Kernel source: `chaingraph/kernels/art-400-check-official-statement-completeness.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:031039a46c60763e68a297e2d0cb28799aa5de6df00d9cd56926d73092ab6b30` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
