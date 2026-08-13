---
type: Attested Computation
title: "C2PA AI/ML Assertion Decoder — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-597-c2pa-aiml-assertion-decoder.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-597-c2pa-aiml-assertion-decoder.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# C2PA AI/ML Assertion Decoder — attested computation

> §10.2 Attested Computation binding for [C2PA AI/ML Assertion Decoder](../tools/art-597-c2pa-aiml-assertion-decoder.md).

## Executor

Kernel source: `chaingraph/kernels/art-597-c2pa-aiml-assertion-decoder.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:d620138d5260a51255c0c89c76d6ae0e99a18d4a396f6b5443ca9aff00e2bd6e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
