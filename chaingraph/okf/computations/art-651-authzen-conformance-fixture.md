---
type: Attested Computation
title: "Authzen Conformance Fixture — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-651-authzen-conformance-fixture.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-651-authzen-conformance-fixture.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Authzen Conformance Fixture — attested computation

> §10.2 Attested Computation binding for [Authzen Conformance Fixture](../tools/art-651-authzen-conformance-fixture.md).

## Executor

Kernel source: `chaingraph/kernels/art-651-authzen-conformance-fixture.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:a5c7470c83caad488c64b75342a1e532d18fc9c76126d3c5cb0614deb36bc15d` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
