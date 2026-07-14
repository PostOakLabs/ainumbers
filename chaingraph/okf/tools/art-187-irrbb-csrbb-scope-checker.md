---
type: DecisionTool
title: "IRRBB CSRBB Scope Checker"
description: "Identify Credit Spread Risk in the Banking Book (CSRBB) scope per EBA Guidelines on IRRBB and CSRBB (EBA/GL/2022/14): instruments held at fair value whose credit-spread risk is not fully captured by credit-risk or IRRBB frameworks (FVOCI/AFS bond books, fair-valued loans, liquidity-buffer bonds) put a bank in scope, requiring a defined methodology and ICAAP inclusion. No EU-wide materiality threshold is prescribed -- proportionality is a competent-authority / institution judgment. Second node of the irrbb-measurement-and-disclosure chain. NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-187-irrbb-csrbb-scope-checker.html
tags: ["compliance_mandate", "wave-33", "mcp:check_irrbb_csrbb_scope"]
timestamp: 2026-07-14
---

# IRRBB CSRBB Scope Checker

> Exports a decision via MCP `check_irrbb_csrbb_scope` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-187-irrbb-csrbb-scope-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [IRRBB Standardised Approach Mapper](./art-186-irrbb-standardised-approach-mapper.md)

**Feeds:** [IRRBB Disclosure Readiness Diagnostic](./art-188-irrbb-disclosure-readiness-diagnostic.md)
