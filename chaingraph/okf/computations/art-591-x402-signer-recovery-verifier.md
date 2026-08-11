---
type: Attested Computation
title: "x402 Signer Recovery Verifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-591-x402-signer-recovery-verifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-591-x402-signer-recovery-verifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# x402 Signer Recovery Verifier — attested computation

> §10.2 Attested Computation binding for [x402 Signer Recovery Verifier](../tools/art-591-x402-signer-recovery-verifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-591-x402-signer-recovery-verifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:4dfa2047d3aeebb35c0825fa07d54d487c7b254d0ad031e2d0c360a3736b5ab7` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
