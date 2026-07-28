---
type: Attested Computation
title: "IDV/KYC Verification-Failure Incident Composer — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-418-idv-verification-failure-incident-composer.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-418-idv-verification-failure-incident-composer.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# IDV/KYC Verification-Failure Incident Composer — attested computation

> §10.2 Attested Computation binding for [IDV/KYC Verification-Failure Incident Composer](../tools/art-418-idv-verification-failure-incident-composer.md).

## Executor

Kernel source: `chaingraph/kernels/art-418-idv-verification-failure-incident-composer.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:90527f7f3f2c9cb095cea22dcaef24642147eb19350d1a0d12bc4eeccc168822` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
