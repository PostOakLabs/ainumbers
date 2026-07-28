---
type: DecisionTool
title: "NAIC RBC Action Level Calculator"
description: "Computes NAIC Risk-Based Capital (RBC) action level classification for US P&C, life, and health insurers. RBC ratio = TAC / ACL * 100%. Action levels: NO_ACTION (>=200%), COMPANY_ACTION (150-200%), REGULATORY_ACTION (100-150%), AUTHORIZED_CONTROL (70-100%), MANDATORY_CONTROL (<70%). Also runs the NAIC trend test (10+ ppt decline two consecutive years with ratio <250%) when prior-year data supplied. Applies NAIC RBC Model Laws #312 (life), #315 (P&C), #315H (health). Use in insurer-rbc-action-level chain (gated on NO_ACTION). ZERO PII: capital totals only."
resource: https://ainumbers.co/chaingraph/art-254-compute-rbc-action-level.html
tags: ["compliance_mandate", "wave-43", "mcp:compute_rbc_action_level"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-254-compute-rbc-action-level.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-254-compute-rbc-action-level.html
    title: "public tool page"
---

# NAIC RBC Action Level Calculator

> Exports a decision via MCP `compute_rbc_action_level` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-254-compute-rbc-action-level.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Life Illustration Self-Support Test (NAIC Model 582)](./art-253-run-illustration-selfsupport-test.md)

**Feeds:** [Claims STP Economics Calculator](./art-257-calculate-claims-stp-economics.md)

## Attested computation

[executor + attester binding](../computations/art-254-compute-rbc-action-level.md) — §10.2.
