---
type: DecisionTool
title: "IRRBB Disclosure Readiness Diagnostic"
description: "A-F IRRBB disclosure readiness diagnostic across five dimensions: EVE shock calculation performed, SOT (EVE + NII) evaluated, standardised approach mapped, CSRBB scope assessed, and Pillar 3 IRRBB1 disclosure template ready. Returns readiness_grade (A-F), readiness_score (0-100), dimensions_met, and gaps list. Terminal node of the irrbb-measurement-and-disclosure chain. BCBS d368 + EBA GL/2022/14 + Pillar 3 IRRBB1. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-188-irrbb-disclosure-readiness-diagnostic.html
tags: ["compliance_mandate", "wave-33", "mcp:run_irrbb_disclosure_fit"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-188-irrbb-disclosure-readiness-diagnostic.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-188-irrbb-disclosure-readiness-diagnostic.html
    title: "public tool page"
---

# IRRBB Disclosure Readiness Diagnostic

> Exports a decision via MCP `run_irrbb_disclosure_fit` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-188-irrbb-disclosure-readiness-diagnostic.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [IRRBB CSRBB Scope Checker](./art-187-irrbb-csrbb-scope-checker.md)

**Feeds:** _terminal node_
