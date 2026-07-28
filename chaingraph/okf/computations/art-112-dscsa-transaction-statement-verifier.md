---
type: Attested Computation
title: "DSCSA Transaction Statement (T3) Verifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-112-dscsa-transaction-statement-verifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-112-dscsa-transaction-statement-verifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# DSCSA Transaction Statement (T3) Verifier — attested computation

> §10.2 Attested Computation binding for [DSCSA Transaction Statement (T3) Verifier](../tools/art-112-dscsa-transaction-statement-verifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-112-dscsa-transaction-statement-verifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:050a30a2760caae0cac020f44dd26cfe3f9be9ec02e89386c12b22dbe18f791c` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
