---
type: Attested Computation
title: "Arc Paymaster Economics Model — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the treasury_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-46-arc-paymaster-model.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-46-arc-paymaster-model.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Arc Paymaster Economics Model — attested computation

> §10.2 Attested Computation binding for [Arc Paymaster Economics Model](../tools/art-46-arc-paymaster-model.md).

## Executor

Kernel source: `chaingraph/kernels/art-46-arc-paymaster-model.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:86b52d9ce0d72966dc6be706fe6621eb0c036d9be967792292fb315dad560cbd` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
