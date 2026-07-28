---
type: Attested Computation
title: "IFRS 17 Loss Component Roll-Forward Tracker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-448-ifrs17-loss-component-tracker.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-448-ifrs17-loss-component-tracker.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# IFRS 17 Loss Component Roll-Forward Tracker — attested computation

> §10.2 Attested Computation binding for [IFRS 17 Loss Component Roll-Forward Tracker](../tools/art-448-ifrs17-loss-component-tracker.md).

## Executor

Kernel source: `chaingraph/kernels/art-448-ifrs17-loss-component-tracker.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:8e097549d34ca1082509778e8da4137f414ab761783cc9babc55ec076010976e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
