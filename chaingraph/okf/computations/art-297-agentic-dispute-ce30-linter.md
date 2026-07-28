---
type: Attested Computation
title: "Agentic Dispute CE3.0 Evidence Linter — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-297-agentic-dispute-ce30-linter.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-297-agentic-dispute-ce30-linter.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Agentic Dispute CE3.0 Evidence Linter — attested computation

> §10.2 Attested Computation binding for [Agentic Dispute CE3.0 Evidence Linter](../tools/art-297-agentic-dispute-ce30-linter.md).

## Executor

Kernel source: `chaingraph/kernels/art-297-agentic-dispute-ce30-linter.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:d3eda08f22ed67d0de0b0d7d5ca2877c9954ecff416aae4cf51d9906260ae374` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
