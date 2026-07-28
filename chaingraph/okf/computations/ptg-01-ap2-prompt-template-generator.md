---
type: Attested Computation
title: "AP2 Prompt Template Generator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the prompt_template decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/ptg-01-ap2-prompt-template-generator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/ptg-01-ap2-prompt-template-generator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# AP2 Prompt Template Generator — attested computation

> §10.2 Attested Computation binding for [AP2 Prompt Template Generator](../tools/ptg-01-ap2-prompt-template-generator.md).

## Executor

Kernel source: `chaingraph/kernels/ptg-01-ap2-prompt-template-generator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:5f23d03d4d538507b92a3f3461e5d0ebb6987227fd3a7ae41281216fc2fabe8e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
