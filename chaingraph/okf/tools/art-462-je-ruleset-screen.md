---
type: DecisionTool
title: "Journal-Entry Ruleset Screen"
description: "Runs a caller-declared, versioned journal-entry testing ruleset over a caller-declared JE extract and flags each entry that trips one or more rules: weekend/holiday postings, round-number entries, suspense/manual-account postings, post-close entries, and unusual user/account pairings. Every firm-specific convention (which rules are active, what counts as a round number, the weekend day set, the holiday calendar, the suspense-account list, the period-close date, the authorized user/account pairing list) is a caller-declared policy input, never a silent default; the ruleset_version string is echoed verbatim in the output so the artifact records exactly which policy vintage produced the flags. Optionally binds to a caller-declared extract_population_hash for audit-trail linkage to a hashed JE population (soft coupling only, e.g. to an art-460-style extract-integrity record if that node has landed). First of three ARCB-K-1 substantive audit-recalculation kernels. NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-462-je-ruleset-screen.html
tags: ["compliance_control", "wave-74", "mcp:screen_je_ruleset"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-462-je-ruleset-screen.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-462-je-ruleset-screen.html
    title: "public tool page"
---

# Journal-Entry Ruleset Screen

> Exports a decision via MCP `screen_je_ruleset` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-462-je-ruleset-screen.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
