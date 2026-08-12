---
type: Attested Computation
title: "ERC-7540 Async-Vault Request Accounting — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the payment_policy decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-611-erc7540-async-vault-request-accounting.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-611-erc7540-async-vault-request-accounting.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ERC-7540 Async-Vault Request Accounting — attested computation

> §10.2 Attested Computation binding for [ERC-7540 Async-Vault Request Accounting](../tools/art-611-erc7540-async-vault-request-accounting.md).

## Executor

Kernel source: `chaingraph/kernels/art-611-erc7540-async-vault-request-accounting.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:5cd9dd6c701f8631291807f556d9b14f7f65bf9ccbacc31d2d089ef3a65c0541` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
