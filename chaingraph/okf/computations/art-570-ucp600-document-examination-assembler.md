---
type: Attested Computation
title: "UCP 600 / ISBP 745 Document Examination Assembler — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-570-ucp600-document-examination-assembler.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-570-ucp600-document-examination-assembler.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# UCP 600 / ISBP 745 Document Examination Assembler — attested computation

> §10.2 Attested Computation binding for [UCP 600 / ISBP 745 Document Examination Assembler](../tools/art-570-ucp600-document-examination-assembler.md).

## Executor

Kernel source: `chaingraph/kernels/art-570-ucp600-document-examination-assembler.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:b120516d58cfb7d8628e27b1cef81b01dbf298a4724dff8548143c422eb588c3` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
