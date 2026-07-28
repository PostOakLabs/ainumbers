---
type: Attested Computation
title: "Reg F Call-Frequency Presumption Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-402-validate-regf-call-frequency.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-402-validate-regf-call-frequency.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Reg F Call-Frequency Presumption Validator — attested computation

> §10.2 Attested Computation binding for [Reg F Call-Frequency Presumption Validator](../tools/art-402-validate-regf-call-frequency.md).

## Executor

Kernel source: `chaingraph/kernels/art-402-validate-regf-call-frequency.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:49d5b68d9b602859352499b88b4a3748a4eb06f8c6e3e58b98c6198ca136bc9f` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
