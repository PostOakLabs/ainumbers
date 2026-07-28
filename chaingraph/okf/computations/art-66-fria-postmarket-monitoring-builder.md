---
type: Attested Computation
title: "FRIA & Post-Market Monitoring Plan Builder — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-66-fria-postmarket-monitoring-builder.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-66-fria-postmarket-monitoring-builder.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# FRIA & Post-Market Monitoring Plan Builder — attested computation

> §10.2 Attested Computation binding for [FRIA & Post-Market Monitoring Plan Builder](../tools/art-66-fria-postmarket-monitoring-builder.md).

## Executor

Kernel source: `chaingraph/kernels/art-66-fria-postmarket-monitoring-builder.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:3aff37d79ff68de2a055c1d32bdabb4376e3fe242656398b2c1d35ca48331cc0` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
