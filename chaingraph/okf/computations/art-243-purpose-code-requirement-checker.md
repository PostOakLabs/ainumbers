---
type: Attested Computation
title: "ISO 20022 Purpose Code Requirement Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-243-purpose-code-requirement-checker.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-243-purpose-code-requirement-checker.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ISO 20022 Purpose Code Requirement Checker — attested computation

> §10.2 Attested Computation binding for [ISO 20022 Purpose Code Requirement Checker](../tools/art-243-purpose-code-requirement-checker.md).

## Executor

Kernel source: `chaingraph/kernels/art-243-purpose-code-requirement-checker.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:2ff736927d33cc21662cf8751c9182933760e8d7bf20ec50e5dcbd5b93e48615` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
