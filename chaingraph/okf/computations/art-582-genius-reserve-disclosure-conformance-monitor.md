---
type: Attested Computation
title: "GENIUS Act Reserve-Disclosure Conformance Monitor — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-582-genius-reserve-disclosure-conformance-monitor.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-582-genius-reserve-disclosure-conformance-monitor.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# GENIUS Act Reserve-Disclosure Conformance Monitor — attested computation

> §10.2 Attested Computation binding for [GENIUS Act Reserve-Disclosure Conformance Monitor](../tools/art-582-genius-reserve-disclosure-conformance-monitor.md).

## Executor

Kernel source: `chaingraph/kernels/art-582-genius-reserve-disclosure-conformance-monitor.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:938dff18fe631418b8fc865198f0e4cb4ca4d6a9ee87967ccf818d5f2189edf9` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
