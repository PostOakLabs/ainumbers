---
type: Attested Computation
title: "TIP-20 Memo/Commitment Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-390-tip20-memo-commitment-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-390-tip20-memo-commitment-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# TIP-20 Memo/Commitment Validator — attested computation

> §10.2 Attested Computation binding for [TIP-20 Memo/Commitment Validator](../tools/art-390-tip20-memo-commitment-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-390-tip20-memo-commitment-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:674c4beec75fed25496ab6ea99dffe58a860e683e6c82485de35ac65bcff7fce` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
