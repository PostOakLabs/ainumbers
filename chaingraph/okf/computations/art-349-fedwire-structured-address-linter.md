---
type: Attested Computation
title: "Fedwire Structured Address Linter — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-349-fedwire-structured-address-linter.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-349-fedwire-structured-address-linter.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Fedwire Structured Address Linter — attested computation

> §10.2 Attested Computation binding for [Fedwire Structured Address Linter](../tools/art-349-fedwire-structured-address-linter.md).

## Executor

Kernel source: `chaingraph/kernels/art-349-fedwire-structured-address-linter.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:5d00ddaa78f298a5fa938bf6f520102ef38a75b1de34b7fdb631905ef13cadc8` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
