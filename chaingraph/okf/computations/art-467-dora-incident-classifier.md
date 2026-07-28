---
type: Attested Computation
title: "DORA ICT Incident Classifier & Reporting Clock — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the attestation_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-467-dora-incident-classifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-467-dora-incident-classifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# DORA ICT Incident Classifier & Reporting Clock — attested computation

> §10.2 Attested Computation binding for [DORA ICT Incident Classifier & Reporting Clock](../tools/art-467-dora-incident-classifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-467-dora-incident-classifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:2f4fe65161e59aee68e9609258e251c1a571a671f2167a00a2d0dc1c514ac4a7` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
