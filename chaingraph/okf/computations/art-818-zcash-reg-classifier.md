---
type: Attested Computation
title: "Privacy Coin Regulatory Classifier (MiCA and AMLR) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-818-zcash-reg-classifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-818-zcash-reg-classifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Privacy Coin Regulatory Classifier (MiCA and AMLR) — attested computation

> §10.2 Attested Computation binding for [Privacy Coin Regulatory Classifier (MiCA and AMLR)](../tools/art-818-zcash-reg-classifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-818-zcash-reg-classifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:e63a3b644b37385180c551cc2febe28fbfc8ac21bc46f60e1b2e673983242e3b` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
