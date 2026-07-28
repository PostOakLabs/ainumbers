---
type: Attested Computation
title: "AI Decision Log Record Builder (EU AI Act Art 12) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-236-build-ai-decision-log-record.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-236-build-ai-decision-log-record.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# AI Decision Log Record Builder (EU AI Act Art 12) — attested computation

> §10.2 Attested Computation binding for [AI Decision Log Record Builder (EU AI Act Art 12)](../tools/art-236-build-ai-decision-log-record.md).

## Executor

Kernel source: `chaingraph/kernels/art-236-build-ai-decision-log-record.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:38e616aa1627146cb9496fe598eea7869de615e58bcc59363e22fc24da851e1c` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
