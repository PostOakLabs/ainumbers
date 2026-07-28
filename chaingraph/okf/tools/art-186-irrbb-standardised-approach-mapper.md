---
type: DecisionTool
title: "IRRBB Standardised Approach Mapper"
description: "Map non-maturing deposit (NMD) positions to the EBA standardised / simplified-standardised approach behavioural caps (BCBS d368 para 87 / Annex 2): retail transactional core proportion capped at 90% / average maturity capped at 5 years; retail non-transactional (savings) core capped at 70% / 4.5 years; wholesale core capped at 50% / 4 years. Flags behavioural-option add-ons (e.g. mortgage prepayment) requiring separate treatment. Root node of the irrbb-measurement-and-disclosure chain. NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-186-irrbb-standardised-approach-mapper.html
tags: ["compliance_mandate", "wave-33", "mcp:map_irrbb_standardised_approach"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-186-irrbb-standardised-approach-mapper.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-186-irrbb-standardised-approach-mapper.html
    title: "public tool page"
---

# IRRBB Standardised Approach Mapper

> Exports a decision via MCP `map_irrbb_standardised_approach` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-186-irrbb-standardised-approach-mapper.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [IRRBB CSRBB Scope Checker](./art-187-irrbb-csrbb-scope-checker.md)
