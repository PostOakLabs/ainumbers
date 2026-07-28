---
type: Attested Computation
title: "Financial-Instrument Regime Mapper — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the crypto_regulatory_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-318-rhc-regime-mapper.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-318-rhc-regime-mapper.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Financial-Instrument Regime Mapper — attested computation

> §10.2 Attested Computation binding for [Financial-Instrument Regime Mapper](../tools/art-318-rhc-regime-mapper.md).

## Executor

Kernel source: `chaingraph/kernels/art-318-rhc-regime-mapper.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:a254b7eb00a32b29a66ec968198d5fcaf29bff88a1a9881739f2a25b5ec59856` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
