---
type: Attested Computation
title: "Metro 2 Credit-Reporting Record Lint — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-398-lint-metro2-record.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-398-lint-metro2-record.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Metro 2 Credit-Reporting Record Lint — attested computation

> §10.2 Attested Computation binding for [Metro 2 Credit-Reporting Record Lint](../tools/art-398-lint-metro2-record.md).

## Executor

Kernel source: `chaingraph/kernels/art-398-lint-metro2-record.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:608cb6a37764d1dacf9fac00e70b7a86486cfe76f10dc6c83b8ab87a4de8d3e5` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
