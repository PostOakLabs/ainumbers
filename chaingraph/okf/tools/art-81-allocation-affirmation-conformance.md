---
type: DecisionTool
title: "Allocation/Affirmation Conformance Checker"
description: "Checks allocation and confirmation/affirmation events against the ESMA CSDR SDR RTS 23:00 CET trade-date rule and the machine-readable-format mandate (binding Dec 2026). Computes per-event pass/fail and batch on-time rate."
resource: https://ainumbers.co/chaingraph/art-81-allocation-affirmation-conformance.html
tags: ["compliance_mandate", "wave-17", "mcp:check_allocation_affirmation"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-81-allocation-affirmation-conformance.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-81-allocation-affirmation-conformance.html
    title: "public tool page"
---

# Allocation/Affirmation Conformance Checker

> Exports a decision via MCP `check_allocation_affirmation` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-81-allocation-affirmation-conformance.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [T+1 Settlement Readiness Diagnostic](./art-77-t1-settlement-readiness-diagnostic.md)

**Feeds:** [Securities-Settlement Message Linter (ISO 20022 sese/semt)](./art-82-securities-settlement-message-linter.md), [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md)
