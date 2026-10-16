---
type: Attested Computation
title: "V4 Hook Fee Conformance — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-709-v4-hook-fee-conformance.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-709-v4-hook-fee-conformance.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# V4 Hook Fee Conformance — attested computation

> §10.2 Attested Computation binding for [V4 Hook Fee Conformance](../tools/art-709-v4-hook-fee-conformance.md).

## Executor

Kernel source: `chaingraph/kernels/art-709-v4-hook-fee-conformance.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:979154bd3601f1c0e64186e41b3c0b9adef0df6842013d20fc0daf76145ef46f` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
