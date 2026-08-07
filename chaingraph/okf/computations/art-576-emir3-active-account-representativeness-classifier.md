---
type: Attested Computation
title: "EMIR 3.0 Active Account Representativeness Classifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-576-emir3-active-account-representativeness-classifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-576-emir3-active-account-representativeness-classifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# EMIR 3.0 Active Account Representativeness Classifier — attested computation

> §10.2 Attested Computation binding for [EMIR 3.0 Active Account Representativeness Classifier](../tools/art-576-emir3-active-account-representativeness-classifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-576-emir3-active-account-representativeness-classifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:61ccaaf1ba92ae118685760e5c4c2d2196095b159dd005a1e79d115d31e544c6` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
