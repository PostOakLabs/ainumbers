---
type: Attested Computation
title: "FinP2P Ledger Proof Verifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-587-finp2p-ledger-proof-verifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-587-finp2p-ledger-proof-verifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# FinP2P Ledger Proof Verifier — attested computation

> §10.2 Attested Computation binding for [FinP2P Ledger Proof Verifier](../tools/art-587-finp2p-ledger-proof-verifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-587-finp2p-ledger-proof-verifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:3c844292a3af41f9d432ae70b2573143e1de22d82b2ddda19f531d233ec06d5f` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
