---
type: Attested Computation
title: "ISO 42001 AIMS Clause Conformance — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-171-iso42001-aims-clause-conformance.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-171-iso42001-aims-clause-conformance.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ISO 42001 AIMS Clause Conformance — attested computation

> §10.2 Attested Computation binding for [ISO 42001 AIMS Clause Conformance](../tools/art-171-iso42001-aims-clause-conformance.md).

## Executor

Kernel source: `chaingraph/kernels/art-171-iso42001-aims-clause-conformance.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:6cf5102a16176e735d0a61a46e5bd06191bbc7ef5d12c2ce96cea472cd55e14f` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
