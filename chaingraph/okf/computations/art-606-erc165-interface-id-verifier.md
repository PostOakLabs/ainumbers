---
type: Attested Computation
title: "ERC-165 Interface ID Verifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-606-erc165-interface-id-verifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-606-erc165-interface-id-verifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ERC-165 Interface ID Verifier — attested computation

> §10.2 Attested Computation binding for [ERC-165 Interface ID Verifier](../tools/art-606-erc165-interface-id-verifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-606-erc165-interface-id-verifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:4e23a23b5e2ec1ba559f1dc3c84e9e352b8006df0c0049b25a218cf70c88fede` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
