---
type: Attested Computation
title: "Call Report Schedule RC (Balance Sheet) Mapper — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the regulatory_reporting decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-432-call-report-rc-balance-sheet.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-432-call-report-rc-balance-sheet.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Call Report Schedule RC (Balance Sheet) Mapper — attested computation

> §10.2 Attested Computation binding for [Call Report Schedule RC (Balance Sheet) Mapper](../tools/art-432-call-report-rc-balance-sheet.md).

## Executor

Kernel source: `chaingraph/kernels/art-432-call-report-rc-balance-sheet.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:ebdcc54a5a9f44bae3307929b2c226e91666a2929a99fb42e15eb5f0df79c7d1` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
