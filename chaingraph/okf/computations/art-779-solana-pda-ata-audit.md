---
type: Attested Computation
title: "Solana PDA Bump and ATA Audit — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-779-solana-pda-ata-audit.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-779-solana-pda-ata-audit.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Solana PDA Bump and ATA Audit — attested computation

> §10.2 Attested Computation binding for [Solana PDA Bump and ATA Audit](../tools/art-779-solana-pda-ata-audit.md).

## Executor

Kernel source: `chaingraph/kernels/art-779-solana-pda-ata-audit.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:cefd23d3e42426f406a46d4672b972845e648d1e31792f91d42a01e132763444` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
