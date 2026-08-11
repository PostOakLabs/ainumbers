---
type: Attested Computation
title: "SLATE Securities-Loan Report Field Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-544-slate-report-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-544-slate-report-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# SLATE Securities-Loan Report Field Validator — attested computation

> §10.2 Attested Computation binding for [SLATE Securities-Loan Report Field Validator](../tools/art-544-slate-report-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-544-slate-report-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:c5c25fd2786de8c58de81203d0b98ca4ebf1060401e29d6cd9594067d49c30c1` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
