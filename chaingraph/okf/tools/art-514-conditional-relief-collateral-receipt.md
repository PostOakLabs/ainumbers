---
type: DecisionTool
title: "Conditional-Relief Collateral Receipt"
description: "Shows, per acceptance and per day, that every condition of a conditional regulatory relief -- no-action, exemptive, or comfort-letter -- held before a firm accepted an asset as collateral in reliance on it: a per-condition PASS/FAIL/UNDECIDABLE verdict against the caller's own versioned condition set (never a silent PASS on absent evidence), a version-staleness check comparing the version the caller relied on against the version the condition set was evidenced against, the applicable capital charge from the caller's own table, and a revocation-exposure figure -- the capital and eligibility delta if the relief were withdrawn at as_of. Portable to any regime -- CFTC, SEC, OCC, FCA, MAS -- the regime label and every condition are caller-supplied policy input, never a hardcoded rule set. Does not rebuild reserve checking (art-06, art-512, art-280) or haircuts/eligibility (art-444, 505, 508, art-320) -- reused upstream in a chain. Renders no eligibility opinion and no investment advice: it reports whether the caller's declared conditions were met against the caller's declared evidence. compliance_control."
resource: https://ainumbers.co/chaingraph/art-514-conditional-relief-collateral-receipt.html
tags: ["compliance_control", "wave-79", "mcp:build_conditional_relief_collateral_receipt"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-514-conditional-relief-collateral-receipt.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-514-conditional-relief-collateral-receipt.html
    title: "public tool page"
---

# Conditional-Relief Collateral Receipt

> Exports a decision via MCP `build_conditional_relief_collateral_receipt` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-514-conditional-relief-collateral-receipt.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-514-conditional-relief-collateral-receipt.md) — §10.2.
