---
type: Attested Computation
title: "TRACE / CAT Reporting Lint — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-397-lint-trace-cat-reports.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-397-lint-trace-cat-reports.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# TRACE / CAT Reporting Lint — attested computation

> §10.2 Attested Computation binding for [TRACE / CAT Reporting Lint](../tools/art-397-lint-trace-cat-reports.md).

## Executor

Kernel source: `chaingraph/kernels/art-397-lint-trace-cat-reports.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:aa77f951451f7ca0f0491377f11ca36e72a6fbe9856e4575cfe2bba60e060379` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
