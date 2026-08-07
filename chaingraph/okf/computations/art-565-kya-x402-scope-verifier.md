---
type: Attested Computation
title: "KYA Credential x x402 Payload Scope Verifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-565-kya-x402-scope-verifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-565-kya-x402-scope-verifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# KYA Credential x x402 Payload Scope Verifier — attested computation

> §10.2 Attested Computation binding for [KYA Credential x x402 Payload Scope Verifier](../tools/art-565-kya-x402-scope-verifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-565-kya-x402-scope-verifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:f6c593e542fe2fbd5e4226a231dff7ce88a280d8fa68cc757c9fe6602afe29f3` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
