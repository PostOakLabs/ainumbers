---
type: Attested Computation
title: "QFC Part 371 Recordkeeping File Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-537-qfc-recordkeeping-file-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-537-qfc-recordkeeping-file-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# QFC Part 371 Recordkeeping File Validator — attested computation

> §10.2 Attested Computation binding for [QFC Part 371 Recordkeeping File Validator](../tools/art-537-qfc-recordkeeping-file-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-537-qfc-recordkeeping-file-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:c7d0608caf559ede9bf75c63cee44bcc4cda97cc043ea6c689707e0e956709b9` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
