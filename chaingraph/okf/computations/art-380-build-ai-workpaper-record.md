---
type: Attested Computation
title: "AI-Tool-Usage Workpaper Record — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-380-build-ai-workpaper-record.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-380-build-ai-workpaper-record.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# AI-Tool-Usage Workpaper Record — attested computation

> §10.2 Attested Computation binding for [AI-Tool-Usage Workpaper Record](../tools/art-380-build-ai-workpaper-record.md).

## Executor

Kernel source: `chaingraph/kernels/art-380-build-ai-workpaper-record.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:15049d4459f060c77f8ccefdcfff425170a1c8103384869b81c002b2f12602b1` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
