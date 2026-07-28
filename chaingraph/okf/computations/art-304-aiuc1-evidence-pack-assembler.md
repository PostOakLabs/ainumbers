---
type: Attested Computation
title: "AIUC-1 Evidence Pack Assembler — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-304-aiuc1-evidence-pack-assembler.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-304-aiuc1-evidence-pack-assembler.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# AIUC-1 Evidence Pack Assembler — attested computation

> §10.2 Attested Computation binding for [AIUC-1 Evidence Pack Assembler](../tools/art-304-aiuc1-evidence-pack-assembler.md).

## Executor

Kernel source: `chaingraph/kernels/art-304-aiuc1-evidence-pack-assembler.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:bde1926d75bbc6dbc37f1d43332bd1684a077131e61b89d6e99929a12b8cf33c` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
