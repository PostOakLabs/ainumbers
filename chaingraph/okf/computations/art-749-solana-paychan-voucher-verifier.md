---
type: Attested Computation
title: "Solana Paychan Voucher Verifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the payment_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-749-solana-paychan-voucher-verifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-749-solana-paychan-voucher-verifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Solana Paychan Voucher Verifier — attested computation

> §10.2 Attested Computation binding for [Solana Paychan Voucher Verifier](../tools/art-749-solana-paychan-voucher-verifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-749-solana-paychan-voucher-verifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:6264bf5f2da03bba7b4b978a27f112253e00955c788b4a28213e38838029744c` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
