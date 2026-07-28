---
type: Attested Computation
title: "QM APR-APOR Spread Classifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-219-qm-apr-apor-spread.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-219-qm-apr-apor-spread.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# QM APR-APOR Spread Classifier — attested computation

> §10.2 Attested Computation binding for [QM APR-APOR Spread Classifier](../tools/art-219-qm-apr-apor-spread.md).

## Executor

Kernel source: `chaingraph/kernels/art-219-qm-apr-apor-spread.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:9a3c7fb7f2a17cb3b8ba3e352f32b1d77d7d51093e23fa65165e7d3d594b106b` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
