---
type: Attested Computation
title: "Contract Bytecode Identity Verifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/810-contract-bytecode-identity-verifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/810-contract-bytecode-identity-verifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Contract Bytecode Identity Verifier — attested computation

> §10.2 Attested Computation binding for [Contract Bytecode Identity Verifier](../tools/810-contract-bytecode-identity-verifier.md).

## Executor

Kernel source: `chaingraph/kernels/810-contract-bytecode-identity-verifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:9bc94068a33ab9fdd9c3323a0e898bb099328f10fb4ca970424388670379e009` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
