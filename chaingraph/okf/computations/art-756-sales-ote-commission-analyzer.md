---
type: Attested Computation
title: "Sales OTE & Commission Analyzer — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the sales_comp_record decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-756-sales-ote-commission-analyzer.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-756-sales-ote-commission-analyzer.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Sales OTE & Commission Analyzer — attested computation

> §10.2 Attested Computation binding for [Sales OTE & Commission Analyzer](../tools/art-756-sales-ote-commission-analyzer.md).

## Executor

Kernel source: `chaingraph/kernels/art-756-sales-ote-commission-analyzer.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:b16c64afb3ceeef8652c4aa0d61ba66b70be5f669ed8970d4a480b4e6aa8b87f` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
