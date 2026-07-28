---
type: Attested Computation
title: "MCP Tool Scope & Revocation Auditor — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-150-mcp-tool-scope-revocation-auditor.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-150-mcp-tool-scope-revocation-auditor.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# MCP Tool Scope & Revocation Auditor — attested computation

> §10.2 Attested Computation binding for [MCP Tool Scope & Revocation Auditor](../tools/art-150-mcp-tool-scope-revocation-auditor.md).

## Executor

Kernel source: `chaingraph/kernels/art-150-mcp-tool-scope-revocation-auditor.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:43b2320d22c9bb43d9f57049be817347d84f13e34532dbec3d13725872886ba2` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
