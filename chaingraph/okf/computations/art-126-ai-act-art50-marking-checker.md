---
type: Attested Computation
title: "EU AI Act Art. 50 Marking Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-126-ai-act-art50-marking-checker.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-126-ai-act-art50-marking-checker.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# EU AI Act Art. 50 Marking Checker — attested computation

> §10.2 Attested Computation binding for [EU AI Act Art. 50 Marking Checker](../tools/art-126-ai-act-art50-marking-checker.md).

## Executor

Kernel source: `chaingraph/kernels/art-126-ai-act-art50-marking-checker.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:3baa21f9a81107596607b29ef5a324d8ef993842384da54dac31e65811e55479` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
