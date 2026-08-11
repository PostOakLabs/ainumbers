---
type: Attested Computation
title: "ACDC Delegation Chain Verifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-285-acdc-delegation-chain-verifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-285-acdc-delegation-chain-verifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ACDC Delegation Chain Verifier — attested computation

> §10.2 Attested Computation binding for [ACDC Delegation Chain Verifier](../tools/art-285-acdc-delegation-chain-verifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-285-acdc-delegation-chain-verifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:6126b6c80552a767fe0de0b45f76f0896f0dbb7f0576c62d25a6968418f9f819` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
