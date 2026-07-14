---
type: DecisionTool
title: "Arc xReserve Config Linter"
description: "8-check A–F linter for an Arc xReserve / on-chain reserve configuration. Checks: reserve sum=100%, GENIUS Act §4 eligible assets (US issuers), GENIUS §4(a)(11) yield prohibition (US PPSIs), MiCA Art. 54 (EU EMIs), USYC composition (0–80% pass), CCTP v2 domains ≥2, attestation cadence, mint/burn role segregation."
resource: https://ainumbers.co/chaingraph/art-45-arc-xreserve-linter.html
tags: ["compliance_mandate", "wave-10", "mcp:lint_arc_xreserve_config", "iso20022:acmt.023"]
timestamp: 2026-07-14
---

# Arc xReserve Config Linter

> Exports a decision via MCP `lint_arc_xreserve_config` — mandate type `compliance_mandate`.

**Deadline:** 2026-07-18 — GENIUS Act §4 eligible-asset backing requirements; MiCA Art. 54 reserve requirements for EU EMT issuers.

**Semantic profile:** `iso20022:acmt.023` (ISO 20022-aligned)

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-45-arc-xreserve-linter.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Arc Fit Diagnostic](./art-42-arc-fit-diagnostic.md)

**Feeds:** _terminal node_
