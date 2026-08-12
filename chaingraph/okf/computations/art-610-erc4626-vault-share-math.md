---
type: Attested Computation
title: "ERC-4626 Vault Share Math — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the payment_policy decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-610-erc4626-vault-share-math.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-610-erc4626-vault-share-math.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ERC-4626 Vault Share Math — attested computation

> §10.2 Attested Computation binding for [ERC-4626 Vault Share Math](../tools/art-610-erc4626-vault-share-math.md).

## Executor

Kernel source: `chaingraph/kernels/art-610-erc4626-vault-share-math.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:b112b2136dc497e69f632232e47a9a70fa63d7dbc3d67c313cf89edb1fb97f33` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
