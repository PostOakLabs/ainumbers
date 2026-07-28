---
type: Attested Computation
title: "Can't Be Evil License Selector — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-196-cant-be-evil-license-selector.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-196-cant-be-evil-license-selector.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Can't Be Evil License Selector — attested computation

> §10.2 Attested Computation binding for [Can't Be Evil License Selector](../tools/art-196-cant-be-evil-license-selector.md).

## Executor

Kernel source: `chaingraph/kernels/art-196-cant-be-evil-license-selector.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:c523b34f5294d1e6632a8ef888455d88c7fd1c912278c3080af0d1abac2527f4` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
