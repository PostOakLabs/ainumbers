---
type: Attested Computation
title: "ERC-2612 Permit Binding Verifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-612-erc2612-permit-binding-verifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-612-erc2612-permit-binding-verifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ERC-2612 Permit Binding Verifier — attested computation

> §10.2 Attested Computation binding for [ERC-2612 Permit Binding Verifier](../tools/art-612-erc2612-permit-binding-verifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-612-erc2612-permit-binding-verifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:a1bb4dd8ffefcc70f0f060116f108f2ff146c650f95ac1ed8d962c838b721ffd` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
