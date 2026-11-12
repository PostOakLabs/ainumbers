---
type: Attested Computation
title: "TSV Tier-Cap Ladder — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-707-tsv-tier-cap-ladder.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-707-tsv-tier-cap-ladder.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# TSV Tier-Cap Ladder — attested computation

> §10.2 Attested Computation binding for [TSV Tier-Cap Ladder](../tools/art-707-tsv-tier-cap-ladder.md).

## Executor

Kernel source: `chaingraph/kernels/art-707-tsv-tier-cap-ladder.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:ec31622899cd563e7242a8382b47262710dadead214839f5029e2dee08ab9e6d` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
