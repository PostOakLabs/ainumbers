---
type: DecisionTool
title: "CASS 15 Safeguarding Reconciliation Check"
description: "Compares a UK payment or e-money firm's safeguarding requirement (CASS 15.8.29G) against the components of its safeguarding resource (CASS 15.8.26R) for one caller-declared as-of date, and classifies the arithmetic outcome as reconciled, shortfall, or excess against a caller-declared tolerance. Resource components carry the four component types CASS 15.8.26R enumerates: relevant funds bank account, segregated but not yet placed, relevant assets, and insurance or guarantee. Money is handled as integer minor units throughout with 2dp display, an empty or zero figure set resolves to a defined verdict, and any value that is not a usable integer amount is named in rejected_inputs rather than silently dropped. Single-run and stateless: the firm performs its reconciliation no less than once each reconciliation day because CASS 15.8.19R requires it of the firm, and this tool operates nothing, stores nothing, and retains nothing. A shortfall verdict is an arithmetic finding about the figures supplied, never a determination that the firm has breached CASS 15."
resource: https://ainumbers.co/chaingraph/art-499-check-safeguarding-reconciliation.html
tags: ["compliance_mandate", "wave-78", "mcp:check_safeguarding_reconciliation"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-499-check-safeguarding-reconciliation.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-499-check-safeguarding-reconciliation.html
    title: "public tool page"
---

# CASS 15 Safeguarding Reconciliation Check

> Exports a decision via MCP `check_safeguarding_reconciliation` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-499-check-safeguarding-reconciliation.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-499-check-safeguarding-reconciliation.md) — §10.2.
