---
type: Attested Computation
title: "EUDI Wallet Credential-Acceptance Readiness Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-13-eudi-wallet-credential-readiness-checker.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-13-eudi-wallet-credential-readiness-checker.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# EUDI Wallet Credential-Acceptance Readiness Checker — attested computation

> §10.2 Attested Computation binding for [EUDI Wallet Credential-Acceptance Readiness Checker](../tools/art-13-eudi-wallet-credential-readiness-checker.md).

## Executor

Kernel source: `chaingraph/kernels/art-13-eudi-wallet-credential-readiness-checker.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:127c97da18f98fb9a3db038f6b7dee0dc52653f7e8d0145b0eb94e0f428c1857` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
